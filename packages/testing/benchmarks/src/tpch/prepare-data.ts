import { resolve } from 'node:path';
import fs from 'node:fs/promises';
import { extractArchive, TPCHData, tpchFiles } from '@dortdb/dataloaders';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const DATA_DIR = resolve(import.meta.dirname, '../../dist/data/tpch');
const ARCHIVE_PATH = resolve(DATA_DIR, 'tpch.zip');

export async function prepareData() {
  if (!(await fs.stat(ARCHIVE_PATH).catch(() => {}))) {
    await downloadData();
  }
  return parseTPCHData();
}

async function downloadData() {
  console.log('Downloading TPCH data...');
  await fs.mkdir(DATA_DIR, { recursive: true });
  const url =
    'https://s3.eu-north-1.amazonaws.com/dortdb.datasets-183601983835-eu-north-1-an/tpch.zip';

  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to download ${url}: ${response.statusText}`);

  await pipeline(
    Readable.fromWeb(response.body as any),
    createWriteStream(ARCHIVE_PATH, { flags: 'w+' }),
  );
  console.log('TPCH data downloaded.');
}

export async function parseTPCHData(): Promise<TPCHData> {
  const archiveStream = createReadStream(ARCHIVE_PATH);
  const result = (await extractArchive(
    archiveStream,
    tpchFiles,
    {} as any,
  )) as any as TPCHData;
  delete (result as any)['defaultGraph'];

  return result;
}
