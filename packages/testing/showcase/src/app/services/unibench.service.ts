import { Injectable } from '@angular/core';
import {
  unibenchGraphTables,
  UnibenchData,
  extractArchive,
  unibenchFiles,
} from '@dortdb/dataloaders';
import { gaLabelsOrType, GraphologyDataAdapter } from '@dortdb/lang-cypher';
import { DatasetService } from './dataset.service';

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

@Injectable({ providedIn: 'root' })
export class UnibenchService extends DatasetService<
  UnibenchData,
  SerializedUnibenchData
> {
  protected override LS_KEY(): string {
    return 'indexeddb-used-unibench';
  }
  protected override OBJ_STORE_NAME(): string {
    return 'unibench';
  }
  protected override DATA_URL(): string {
    return 'https://s3.eu-north-1.amazonaws.com/dortdb.datasets-183601983835-eu-north-1-an/Unibench-0.2.sample.zip';
  }
  protected override DB_KEY(): string {
    return 'data';
  }
  protected override DB_NAME(): string {
    return 'unibench';
  }
  protected override DB_VERSION(): number {
    return 3;
  }

  constructor() {
    super();

    // migration
    if (localStorage.getItem('indexeddb-used')) {
      localStorage.removeItem('indexeddb-used');
      localStorage.setItem('indexeddb-used-unibench', 'true');
      this.dbPopulated.set(true);
    }
  }

  protected serializeData(data: UnibenchData): SerializedUnibenchData {
    return {
      ...data,
      socialNetwork: GraphologyDataAdapter.export(data.socialNetwork),
      invoices: new XMLSerializer().serializeToString(data.invoices),
    };
  }

  protected deserializeData(serialized: SerializedUnibenchData): UnibenchData {
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

  protected extractArchive(
    archive: AsyncIterable<Uint8Array<ArrayBufferLike>>,
  ): Promise<UnibenchData> {
    return extractArchive(
      archive,
      unibenchFiles,
      new DOMParser(),
      'socialNetwork',
      unibenchGraphTables,
    ) as Promise<any> as Promise<UnibenchData>;
  }
}
