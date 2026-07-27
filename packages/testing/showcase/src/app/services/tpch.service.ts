import { Injectable } from '@angular/core';
import { extractArchive, TpchData, tpchFiles } from '@dortdb/dataloaders';
import { DatasetService } from './dataset.service';

@Injectable({ providedIn: 'root' })
export class TPCHService extends DatasetService<TpchData> {
  protected override LS_KEY(): string {
    return 'indexeddb-used-tpch';
  }
  protected override OBJ_STORE_NAME(): string {
    return 'tpch';
  }
  protected override DATA_URL(): string {
    return 'https://s3.eu-north-1.amazonaws.com/dortdb.datasets-183601983835-eu-north-1-an/tpch.zip';
  }
  protected override DB_KEY(): string {
    return 'data';
  }
  protected override DB_NAME(): string {
    return 'tpch';
  }
  protected override DB_VERSION(): number {
    return 1;
  }

  protected override serializeData(data: TpchData): TpchData {
    return data;
  }
  protected override deserializeData(serialized: TpchData): TpchData {
    return serialized;
  }

  constructor() {
    super();
  }

  protected extractArchive(
    archive: AsyncIterable<Uint8Array<ArrayBufferLike>>,
  ): Promise<TpchData> {
    console.log('Processing TPCH archive...');
    return extractArchive(archive, tpchFiles).then((res) => {
      console.log('TPCH archive processed');
      return res;
    }) as Promise<any> as Promise<TpchData>;
  }
}
