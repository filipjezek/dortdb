import { computed, Injectable, Signal, signal } from '@angular/core';
import {
  asapScheduler,
  from,
  generate,
  map,
  Observable,
  switchMap,
  tap,
} from 'rxjs';
import * as zip from '@zip.js/zip.js';
import { MultiDirectedGraph } from 'graphology';
import { CSVParser } from '../utils/csv-parser';
import { NDJSONParser } from '../utils/ndjson-parser';

const LS_KEY = 'indexeddb-used';
const DB_NAME = 'unibench';
const OBJ_STORE_NAME = 'unibench';
const DB_KEY = 'data';

function promisify<T extends IDBRequest>(req: T): Promise<T['result']>;
function promisify(req: IDBTransaction): Promise<IDBTransaction>;
function promisify(req: IDBTransaction | IDBRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    if (req instanceof IDBTransaction) {
      req.oncomplete = () => resolve(req);
    } else {
      req.onsuccess = () => resolve(req.result);
    }
    req.onerror = () => reject(req.error);
  });
}

interface SerializedUnibenchData
  extends Omit<UnibenchData, 'socialNetwork' | 'invoices'> {
  invoices: string; // XML serialized as string
  socialNetwork: unknown; // Serialized MultiDirectedGraph
}

export interface UnibenchData {
  customers: Record<string, any>[];
  invoices: Document;
  orders: Record<string, any>[];
  feedback: Record<string, any>[];
  products: Record<string, any>[];
  brandProducts: Record<string, any>[];
  vendors: Record<string, any>[];
  socialNetwork: MultiDirectedGraph;
  posts: Record<string, any>[];
}
type UnibenchObjectKeys = keyof {
  [K in keyof UnibenchData as UnibenchData[K] extends Record<string, any>[]
    ? K
    : never]: any;
};
interface CSVParseOptions {
  key: UnibenchObjectKeys;
  cast?: Record<string, (v: string) => any>;
  columns?: string[];
  separator?: string;
}
type StreamedEntry = Omit<zip.Entry, 'getData'> & {
  readable?: ReadableStream<Uint8Array>;
};

export type DataLocation = 'indexeddb' | 'memory' | 'remote';

@Injectable({ providedIn: 'root' })
export class UnibenchService {
  private data = signal<UnibenchData>(null);
  private rawData: ArrayBuffer;
  private rawDataView: Uint8Array;
  /**
   * we do this because access to indexedDB requires user confirmation
   * and we don't want to ask the user for confirmation if we don't need it
   */
  private dbPopulated = signal<boolean>(!!localStorage.getItem(LS_KEY));

  private static readonly csvTables: Record<string, CSVParseOptions> = {
    'Dataset/Customer/person_0_0.csv': {
      key: 'customers',
      cast: {
        id: Number,
        birthday: (v: string) => new Date(v),
        creationDate: (v: string) => new Date(v),
        place: Number,
      },
      separator: '|',
    },
    'Dataset/Feedback/Feedback.csv': {
      key: 'feedback',
      cast: {
        personId: Number,
      },
      columns: ['productAsin', 'personId', 'feedback'],
      separator: '|',
    },
    'Dataset/Product/BrandByProduct.csv': {
      key: 'brandProducts',
      columns: ['brandName', 'productId'],
      cast: {
        productId: Number,
      },
    },
    'Dataset/Product/Product.csv': {
      key: 'products',
      cast: {
        price: Number,
        productId: Number,
        brand: Number,
      },
    },
    'Dataset/Vendor/Vendor.csv': { key: 'vendors' },
    'Dataset/SocialNetwork/post_0_0.csv': {
      key: 'posts',
      cast: { id: Number, creationDate: (v: string) => new Date(v) },
      separator: '|',
    },
  };

  public downloadProgress = signal<number>(undefined);
  public dataLocation = computed<DataLocation>(() => {
    if (this.dbPopulated()) {
      return 'indexeddb';
    }
    if (this.data()) {
      return 'memory';
    }
    return 'remote';
  });

  constructor() {}

  public async getDataIfAvailable(): Promise<UnibenchData> {
    if (this.data()) {
      return this.data();
    }

    return this.checkIndexedDB();
  }

  public downloadData(): Promise<UnibenchData> {
    this.downloadProgress.set(0);
    let bytesRead = 0;
    const stream = from(
      fetch(
        'https://s3.eu-north-1.amazonaws.com/dortdb.unibench/Unibench-0.2.sample.zip',
      ),
    ).pipe(
      switchMap((resp) => {
        this.rawData = new ArrayBuffer(+resp.headers.get('Content-Length'));
        this.rawDataView = new Uint8Array(this.rawData);
        return this.iterStream(resp.body);
      }),
      tap((chunk) => {
        this.rawDataView.set(chunk, bytesRead);
        bytesRead += chunk.length;
        this.downloadProgress.set(bytesRead / this.rawData.byteLength);
      }),
    );
    return this.processArchive(stream);
  }

  private async checkIndexedDB(): Promise<UnibenchData> {
    if (!this.dbPopulated()) return null;
    let serialized: SerializedUnibenchData;
    try {
      const db = await promisify(indexedDB.open(DB_NAME, 2));
      const tx = db.transaction(OBJ_STORE_NAME, 'readonly');
      const store = tx.objectStore(OBJ_STORE_NAME);
      serialized = await promisify(store.get(DB_KEY));
    } catch (e) {
      console.error('Error accessing IndexedDB:', e);
      return null;
    }

    if (!serialized) {
      console.warn('No data found in IndexedDB');
      return null;
    }
    this.data.set(this.deserializeData(serialized));
    return this.data();
  }

  public async saveToIndexedDB(): Promise<void> {
    const dbReq = indexedDB.open(DB_NAME, 2);
    dbReq.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (db.objectStoreNames.contains(OBJ_STORE_NAME)) {
        db.deleteObjectStore(OBJ_STORE_NAME);
      }
      db.createObjectStore(OBJ_STORE_NAME);
    };
    const db = await promisify(dbReq);
    const tx = db.transaction(OBJ_STORE_NAME, 'readwrite');
    const store = tx.objectStore(OBJ_STORE_NAME);
    store.put(this.serializeData(), DB_KEY);
    await promisify(tx);
    localStorage.setItem(LS_KEY, 'true');
    this.dbPopulated.set(true);
  }

  private serializeData(): SerializedUnibenchData {
    const d = this.data();
    return {
      ...d,
      socialNetwork: d.socialNetwork.export(),
      invoices: new XMLSerializer().serializeToString(d.invoices),
    };
  }

  private deserializeData(serialized: SerializedUnibenchData): UnibenchData {
    return {
      ...serialized,
      socialNetwork: new MultiDirectedGraph().import(serialized.socialNetwork),
      invoices: new DOMParser().parseFromString(
        serialized.invoices,
        'text/xml',
      ),
    };
  }

  public async clear(): Promise<void> {
    const db = await promisify(indexedDB.open(DB_NAME, 2));
    const tx = db.transaction(OBJ_STORE_NAME, 'readwrite');
    const store = tx.objectStore(OBJ_STORE_NAME);
    store.clear();
    await promisify(tx);
    localStorage.removeItem(LS_KEY);
    this.dbPopulated.set(false);
  }

  private async processArchive(
    archive: Observable<Uint8Array<ArrayBufferLike>>,
  ): Promise<UnibenchData> {
    const reader = new zip.ZipReaderStream();
    const writer = reader.writable.getWriter();
    archive.subscribe({
      next: (chunk) => writer.write(chunk),
      complete: () => writer.close(),
    });

    const graph = new MultiDirectedGraph();
    const result = { socialNetwork: graph } as UnibenchData;
    const promises: Promise<unknown>[] = [];
    for await (const entry of this.iterStream(reader.readable)) {
      if (entry.filename in UnibenchService.csvTables) {
        promises.push(this.parseCSVTable(entry, result));
      } else if (entry.filename === 'Dataset/Invoice/Invoice.xml') {
        promises.push(this.parseInvoices(entry, result));
      } else if (entry.filename === 'Dataset/Order/Order.json') {
        promises.push(this.parseOrders(entry, result));
      } else if (
        entry.filename.startsWith('Dataset/SocialNetwork/') &&
        entry.filename.endsWith('.csv')
      ) {
        promises.push(this.csvToGraph(entry, graph));
      }
    }
    await Promise.all(promises);
    console.log('Unibench data loaded');
    this.data.set(result);
    return result;
  }

  private async *iterStream<T>(stream: ReadableStream<T>) {
    const reader = stream.getReader();
    try {
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async toArray<T>(iter: AsyncIterable<T>): Promise<T[]> {
    const arr: T[] = [];
    for await (const item of iter) {
      arr.push(item);
    }
    return arr;
  }
  private async streamToString(
    stream: ReadableStream<string>,
  ): Promise<string> {
    let str = '';
    for await (const item of this.iterStream(stream)) {
      str += item;
    }
    return str;
  }

  private async parseCSVTable(entry: StreamedEntry, result: UnibenchData) {
    const now = Date.now();
    const opts = UnibenchService.csvTables[entry.filename];
    const stream = entry.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(
        new CSVParser({
          delimiter: opts.separator ?? ',',
          escape: '\\',
          columns: opts.columns ?? true,
          cast: (val, ctx) => {
            if (ctx.header) return val;
            if (opts.cast?.[ctx.column]) {
              return opts.cast[ctx.column](val);
            }
            return val;
          },
        }),
      );
    result[opts.key] = await this.toArray(this.iterStream(stream));
    console.log(`${opts.key} parsed in ${(Date.now() - now) / 1000} s`);
  }

  private async parseInvoices(entry: StreamedEntry, result: UnibenchData) {
    const now = Date.now();
    const stream = entry.readable.pipeThrough(new TextDecoderStream());
    const text = await this.streamToString(stream);
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    result.invoices = xml;
    console.log('Invoices parsed in', (Date.now() - now) / 1000, 's');
  }

  private async parseOrders(entry: StreamedEntry, result: UnibenchData) {
    const now = Date.now();
    const stream = entry.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new NDJSONParser());
    result.orders = await this.toArray(this.iterStream(stream));
    console.log('Orders parsed in', (Date.now() - now) / 1000, 's');
  }

  private async csvToGraph(entry: StreamedEntry, graph: MultiDirectedGraph) {
    const now = Date.now();
    const [from, edgeType, to] = entry.filename.split('/').pop().split('_');
    const stream = entry.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(
        new CSVParser({
          delimiter: '|',
          cast: true,
          castDate: true,
          columns: undefined,
        }),
      );
    const iter = this.iterStream(stream)[
      Symbol.asyncIterator
    ]() as any as AsyncIterableIterator<any[]>;
    const currentState = await iter.next();
    const edgeProps = currentState.value.slice(2) as string[];
    for await (const row of iter) {
      const fromNode = from + row[0];
      const toNode = to + row[1];
      graph.mergeNode(fromNode, { id: row[0], labels: [from] });
      graph.mergeNode(toNode, { id: row[1], labels: [to] });
      graph.addEdge(fromNode, toNode, {
        type: edgeType,
        ...Object.fromEntries(edgeProps.map((key, i) => [key, row[2 + i]])),
      });
    }
    console.log(entry.filename, 'parsed in', (Date.now() - now) / 1000, 's');
  }
}
