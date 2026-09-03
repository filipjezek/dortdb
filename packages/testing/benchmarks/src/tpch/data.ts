import { getParsedData } from '../utils/data-loader.js';
import { extractArchive, TpchData, tpchFiles } from '@dortdb/dataloaders';

export function prepareData(dataUrl: string): Promise<TpchData> {
  return getParsedData(dataUrl, async (stream) => {
    const result = (await extractArchive(
      stream,
      tpchFiles,
      {} as any,
    )) as unknown as TpchData;

    delete (result as any)['defaultGraph'];

    return result;
  });
}
