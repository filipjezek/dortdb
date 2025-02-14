import { resolve } from 'node:path';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { Extract } from 'unzipper';

export const DATA_DIR = resolve(import.meta.dirname, '../dist/unibench/data');

export async function prepareData() {
  if (!(await fs.stat(resolve(DATA_DIR, 'Dataset')).catch(() => {}))) {
    await downloadData();
  }
}

async function downloadData() {
  console.log('Downloading Unibench data...');
  const url =
    'https://github.com/HY-UDBMS/UniBench/releases/download/0.2/Unibench-0.2.zip';

  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to download ${url}: ${response.statusText}`);

  await pipeline(
    Readable.fromWeb(response.body as any),
    Extract({ path: DATA_DIR })
  );
  console.log('Unibench data downloaded.');
}
