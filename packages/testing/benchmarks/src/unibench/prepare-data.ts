import { resolve } from 'node:path';
import fs from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import {
  extractArchive,
  UnibenchData,
  unibenchFiles,
  unibenchGraphTables,
} from '@dortdb/dataloaders';
import { DOMParser } from 'slimdom';

export const DATA_DIR = resolve(import.meta.dirname, '../../dist/data');
const ARCHIVE_PATH = resolve(DATA_DIR, 'unibench.zip');

export async function prepareData() {
  if (!(await fs.stat(ARCHIVE_PATH).catch(() => {}))) {
    await downloadData();
  }
  return parseUnibenchData();
}

async function downloadData() {
  console.log('Downloading Unibench data...');
  await fs.mkdir(DATA_DIR, { recursive: true });
  const url =
    'https://github.com/HY-UDBMS/UniBench/releases/download/0.2/Unibench-0.2.zip';
  // 'https://s3.eu-north-1.amazonaws.com/dortdb.unibench/Unibench-0.2.sample.zip';

  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to download ${url}: ${response.statusText}`);

  await pipeline(
    Readable.fromWeb(response.body as any),
    createWriteStream(ARCHIVE_PATH, { flags: 'w+' }),
  );
  console.log('Unibench data downloaded.');
}

export async function parseUnibenchData(): Promise<UnibenchData> {
  performance.mark('parseUnibenchData_start');
  const archiveStream = createReadStream(ARCHIVE_PATH);
  const result = (await extractArchive(
    archiveStream,
    unibenchFiles,
    new DOMParser(),
    'socialNetwork',
    unibenchGraphTables,
  )) as any as UnibenchData;
  performance.mark('parseUnibenchData_end');
  performance.measure(
    'parseUnibenchData',
    'parseUnibenchData_start',
    'parseUnibenchData_end',
  );

  return result;
}
