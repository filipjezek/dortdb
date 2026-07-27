import { resolve } from 'node:path';
import type { ReadStream } from 'node:fs';
import { getParsedData } from '../utils/data-loader.js';
import { extractArchive, TpchData, tpchFiles } from '@dortdb/dataloaders';

const DATA_DIR = resolve(import.meta.dirname, '../../dist/data/tpch');
const DEFAULT_URL = 'https://s3.eu-north-1.amazonaws.com/dortdb.datasets-183601983835-eu-north-1-an/tpch.zip';

export function prepareData(dataUrl: string | undefined): Promise<TpchData> {
  const finalUrl = dataUrl ?? DEFAULT_URL;
  return getParsedData(finalUrl, 'tpch', DATA_DIR, parseTpchData);
}

async function parseTpchData(stream: ReadStream): Promise<TpchData> {
  const result = (await extractArchive(
    stream,
    tpchFiles,
    {} as any,
  )) as unknown as TpchData;

  delete (result as any)['defaultGraph'];

  return result;
}
