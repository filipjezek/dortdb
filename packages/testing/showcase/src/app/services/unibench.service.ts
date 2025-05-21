import { Injectable } from '@angular/core';
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
}
type StreamedEntry = Omit<zip.Entry, 'getData'> & {
  readable?: ReadableStream<Uint8Array>;
};

export type DataLocation = 'indexeddb' | 'memory' | 'remote';

@Injectable({ providedIn: 'root' })
export class UnibenchService {
  private data: UnibenchData;
  private rawData: ArrayBuffer;
  private rawDataView: Uint8Array;
  /**
   * we do this because access to indexedDB requires user confirmation
   * and we don't want to ask the user for confirmation if we don't need it
   */
  private dbPopulated = !!localStorage.getItem(LS_KEY);

  private static readonly csvTables: Record<string, CSVParseOptions> = {
    'Dataset/Customer/person_0_0.csv': {
      key: 'customers',
      cast: {
        id: Number,
        birthday: (v: string) => new Date(v),
        creationDate: (v: string) => new Date(v),
        place: Number,
      },
    },
    'Dataset/Feedback/Feedback.csv': {
      key: 'feedback',
      cast: {
        personId: Number,
      },
      columns: ['productAsin', 'personId', 'rating'],
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
    },
  };

  private _downloadProgress: number = undefined;
  public get downloadProgress(): number {
    return this._downloadProgress;
  }
  public get dataLocation(): DataLocation {
    if (this.dbPopulated) {
      return 'indexeddb';
    }
    if (this.data) {
      return 'memory';
    }
    return 'remote';
  }

  constructor() {}

  public async getDataIfAvailable(): Promise<UnibenchData> {
    if (this.data) {
      return this.data;
    }

    return this.checkIndexedDB();
  }

  public downloadData(): Promise<UnibenchData> {
    this._downloadProgress = 0;
    const stream = from(
      fetch(
        'https://github.com/HY-UDBMS/UniBench/releases/download/0.2/Unibench-0.2.zip',
      ),
    ).pipe(
      switchMap((resp) => {
        this.rawData = new ArrayBuffer(+resp.headers.get('Content-Length'));
        this.rawDataView = new Uint8Array(this.rawData);
        return this.iterStream(resp.body);
      }),
      tap((chunk) => {
        this.rawDataView.set(chunk, this._downloadProgress);
        this._downloadProgress += chunk.length;
      }),
    );
    return this.processArchive(stream);
  }

  private async checkIndexedDB(): Promise<UnibenchData> {
    if (!this.dbPopulated) return null;
    let ab: ArrayBuffer;
    try {
      const db = await promisify(indexedDB.open(DB_NAME, 1));
      const tx = db.transaction(OBJ_STORE_NAME, 'readonly');
      const store = tx.objectStore(OBJ_STORE_NAME);
      ab = await promisify(store.get(DB_KEY));
    } catch (e) {
      console.error('Error accessing IndexedDB:', e);
      return null;
    }

    const windowSize = 10000;
    const stream = generate({
      initialState: 0,
      condition: (i) => i < ab.byteLength,
      iterate: (i) => i + windowSize,
      scheduler: asapScheduler,
    }).pipe(
      map(
        (i) => new Uint8Array(ab, i, Math.min(windowSize, ab.byteLength - i)),
      ),
    );
    return this.processArchive(stream);
  }

  public async saveToIndexedDB(): Promise<void> {
    const dbReq = indexedDB.open(DB_NAME, 1);
    dbReq.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(OBJ_STORE_NAME)) {
        db.createObjectStore(OBJ_STORE_NAME);
      }
    };
    const db = await promisify(dbReq);
    const tx = db.transaction(OBJ_STORE_NAME, 'readwrite');
    const store = tx.objectStore(OBJ_STORE_NAME);
    store.put(this.rawData, DB_KEY);
    await promisify(tx);
    localStorage.setItem(LS_KEY, 'true');
    this.dbPopulated = true;
  }

  public async clear(): Promise<void> {
    const db = await promisify(indexedDB.open(DB_NAME, 1));
    const tx = db.transaction(OBJ_STORE_NAME, 'readwrite');
    const store = tx.objectStore(OBJ_STORE_NAME);
    store.clear();
    await promisify(tx);
    localStorage.removeItem(LS_KEY);
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
      } else if (entry.filename.startsWith('Dataset/SocialNetwork/')) {
        promises.push(this.csvToGraph(entry, graph));
      }
    }
    await Promise.all(promises);
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
    const opts = UnibenchService.csvTables[entry.filename];
    const stream = entry.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(
        new CSVParser({
          delimiter: '|',
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
  }

  private async parseInvoices(entry: StreamedEntry, result: UnibenchData) {
    const stream = entry.readable.pipeThrough(new TextDecoderStream());
    const text = await this.streamToString(stream);
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    result.invoices = xml;
  }

  private async parseOrders(entry: StreamedEntry, result: UnibenchData) {
    const stream = entry.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new NDJSONParser());
    result.orders = await this.toArray(this.iterStream(stream));
  }

  private async csvToGraph(entry: StreamedEntry, graph: MultiDirectedGraph) {
    const [from, edgeType, to] = entry.filename.split('/').pop().split('_');
    const stream = entry.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(
        new CSVParser({
          delimiter: '|',
          cast: true,
          castDate: true,
        }),
      );
    const iter = this.iterStream(stream)[
      Symbol.asyncIterator
    ]() as any as AsyncIterableIterator<any[]>;
    const edgeProps = (await iter.next()).value.slice(2) as string[];
    for await (const row of iter) {
      graph.addNode(from + row[0], { id: row[0], labels: [from] });
      graph.addNode(to + row[1], { id: row[1], labels: [to] });
      graph.addEdge(from + row[0], to + row[1], {
        type: edgeType,
        ...Object.fromEntries(edgeProps.map((key, i) => [key, row[2 + i]])),
      });
    }
  }
}
