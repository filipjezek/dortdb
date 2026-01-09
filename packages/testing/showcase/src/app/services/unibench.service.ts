import { computed, Injectable, signal } from '@angular/core';
import {
  unibenchGraphTables,
  UnibenchData,
  extractArchive,
  iterStream,
  unibenchFiles,
} from '@dortdb/dataloaders';
import { gaLabelsOrType, GraphologyDataAdapter } from '@dortdb/lang-cypher';

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

interface SerializedUnibenchData extends Omit<
  UnibenchData,
  'socialNetwork' | 'invoices'
> {
  invoices: string; // XML serialized as string
  socialNetwork: unknown; // Serialized MultiDirectedGraph
}

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
    const stream = async function* (this: UnibenchService) {
      const resp = await fetch(
        'https://s3.eu-north-1.amazonaws.com/dortdb.unibench/Unibench-0.2.sample.zip',
      );
      this.rawData = new ArrayBuffer(+resp.headers.get('Content-Length'));
      this.rawDataView = new Uint8Array(this.rawData);
      for await (const chunk of iterStream(resp.body)) {
        this.rawDataView.set(chunk, bytesRead);
        bytesRead += chunk.length;
        this.downloadProgress.set(bytesRead / this.rawData.byteLength);
        yield chunk;
      }
    }.bind(this)();
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
      socialNetwork: GraphologyDataAdapter.export(d.socialNetwork),
      invoices: new XMLSerializer().serializeToString(d.invoices),
    };
  }

  private deserializeData(serialized: SerializedUnibenchData): UnibenchData {
    const result = {
      ...serialized,
      socialNetwork: GraphologyDataAdapter.import(serialized.socialNetwork),
      invoices: new DOMParser().parseFromString(
        serialized.invoices,
        'text/xml',
      ),
    };
    if (
      !result.socialNetwork.nodeEntries().next().value.attributes[
        gaLabelsOrType
      ]
    ) {
      alert(
        'Warning: You seem to be using an old version of the Unibench data stored in IndexedDB.\n' +
          'Please clear the stored data (using the button in the UI) and re-download it.',
      );
    }

    return result;
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
    archive: AsyncIterable<Uint8Array<ArrayBufferLike>>,
  ): Promise<UnibenchData> {
    const result = (await extractArchive(
      archive,
      unibenchFiles,
      new DOMParser(),
      'socialNetwork',
      unibenchGraphTables,
    )) as any as UnibenchData;

    this.data.set(result);
    return result;
  }
}
