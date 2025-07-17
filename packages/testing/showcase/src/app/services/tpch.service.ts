import { Injectable, signal } from '@angular/core';
import {
  extractArchive,
  iterStream,
  TPCHData,
  tpchFiles,
} from '@dortdb/dataloaders';

@Injectable({ providedIn: 'root' })
export class TPCHService {
  private data = signal<TPCHData>(null);
  private rawData: ArrayBuffer;
  private rawDataView: Uint8Array;

  constructor() {}

  public downloadData(): Promise<TPCHData> {
    let bytesRead = 0;
    const stream = async function* (this: TPCHService) {
      const resp = await fetch('tpch.zip');
      this.rawData = new ArrayBuffer(+resp.headers.get('Content-Length'));
      this.rawDataView = new Uint8Array(this.rawData);
      for await (const chunk of iterStream(resp.body)) {
        this.rawDataView.set(chunk, bytesRead);
        bytesRead += chunk.length;
        yield chunk;
      }
    }.bind(this)();
    return this.processArchive(stream);
  }

  private async processArchive(
    archive: AsyncIterable<Uint8Array<ArrayBufferLike>>,
  ): Promise<TPCHData> {
    console.log('Processing TPCH archive...');
    const result = (await extractArchive(
      archive,
      tpchFiles,
    )) as any as TPCHData;

    console.log('TPCH archive processed successfully.');

    this.data.set(result);
    return result;
  }
}
