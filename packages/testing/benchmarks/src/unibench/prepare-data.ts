import { resolve } from 'node:path';
import type { ReadStream } from 'node:fs';
import { getParsedData } from '../utils/data-loader.js';
import { extractArchive, UnibenchData, unibenchFiles, unibenchGraphTables } from '@dortdb/dataloaders';
import { DOMParser } from 'slimdom';

const DATA_DIR = resolve(import.meta.dirname, '../../dist/data');
// const DEFAULT_URL = 'https://github.com/HY-UDBMS/UniBench/releases/download/0.2/Unibench-0.2.zip';
const DEFAULT_URL = 'https://s3.eu-north-1.amazonaws.com/dortdb.datasets-183601983835-eu-north-1-an/Unibench-0.2.sample.zip';

export function prepareData(dataUrl: string | undefined): Promise<UnibenchData> {
  const finalUrl = dataUrl ?? DEFAULT_URL;
  return getParsedData(finalUrl, 'unibench', DATA_DIR, parseUnibenchData);
}

async function parseUnibenchData(stream: ReadStream): Promise<UnibenchData> {
  const result = (await extractArchive(
    stream,
    unibenchFiles,
    new DOMParser() as any,
    'socialNetwork',
    unibenchGraphTables,
  )) as unknown as UnibenchData;

  return result;
}
