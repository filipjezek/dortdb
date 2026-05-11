import { computed, signal } from '@angular/core';
import { iterStream } from '@dortdb/dataloaders';

export type DataLocation = 'indexeddb' | 'memory' | 'remote';

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

export abstract class DatasetService<Data, SerializedData = Data> {
  protected abstract LS_KEY(): string;
  protected abstract OBJ_STORE_NAME(): string;
  protected abstract DATA_URL(): string;
  protected abstract DB_KEY(): string;
  protected abstract DB_NAME(): string;
  protected abstract DB_VERSION(): number;

  protected data = signal<Data>(null);
  protected rawData: ArrayBuffer;
  protected rawDataView: Uint8Array;
  /**
   * we do this because access to indexedDB requires user confirmation
   * and we don't want to ask the user for confirmation if we don't need it
   */
  protected dbPopulated = signal<boolean>(
    !!localStorage.getItem(this.LS_KEY()),
  );

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

  public async getDataIfAvailable(): Promise<Data> {
    if (this.data()) {
      return this.data();
    }

    return this.checkIndexedDB();
  }

  public async downloadData(): Promise<Data> {
    this.downloadProgress.set(0);
    let bytesRead = 0;
    const stream = async function* (
      this: DatasetService<Data, SerializedData>,
    ) {
      const resp = await fetch(this.DATA_URL());
      this.rawData = new ArrayBuffer(+resp.headers.get('Content-Length'));
      this.rawDataView = new Uint8Array(this.rawData);
      for await (const chunk of iterStream(resp.body)) {
        this.rawDataView.set(chunk, bytesRead);
        bytesRead += chunk.length;
        this.downloadProgress.set(bytesRead / this.rawData.byteLength);
        yield chunk;
      }
    }.bind(this)();

    const res = await this.extractArchive(stream);
    this.data.set(res);
    return res;
  }

  protected async checkIndexedDB(): Promise<Data> {
    if (!this.dbPopulated()) return null;
    let serialized: SerializedData;
    try {
      const db = await promisify(
        indexedDB.open(this.DB_NAME(), this.DB_VERSION()),
      );
      const tx = db.transaction(this.OBJ_STORE_NAME(), 'readonly');
      const store = tx.objectStore(this.OBJ_STORE_NAME());
      serialized = await promisify(store.get(this.DB_KEY()));
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
    const dbReq = indexedDB.open(this.DB_NAME(), this.DB_VERSION());
    dbReq.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (db.objectStoreNames.contains(this.OBJ_STORE_NAME())) {
        db.deleteObjectStore(this.OBJ_STORE_NAME());
      }
      db.createObjectStore(this.OBJ_STORE_NAME());
    };
    const db = await promisify(dbReq);
    const tx = db.transaction(this.OBJ_STORE_NAME(), 'readwrite');
    const store = tx.objectStore(this.OBJ_STORE_NAME());
    store.put(this.serializeData(this.data()), this.DB_KEY());
    await promisify(tx);
    localStorage.setItem(this.LS_KEY(), 'true');
    this.dbPopulated.set(true);
  }

  protected abstract serializeData(data: Data): SerializedData;

  protected abstract deserializeData(serialized: SerializedData): Data;

  public async clear(): Promise<void> {
    const db = await promisify(
      indexedDB.open(this.DB_NAME(), this.DB_VERSION()),
    );
    const tx = db.transaction(this.OBJ_STORE_NAME(), 'readwrite');
    const store = tx.objectStore(this.OBJ_STORE_NAME());
    store.clear();
    await promisify(tx);
    localStorage.removeItem(this.LS_KEY());
    this.dbPopulated.set(false);
  }

  protected abstract extractArchive(
    archive: AsyncIterable<Uint8Array<ArrayBufferLike>>,
  ): Promise<Data>;
}
