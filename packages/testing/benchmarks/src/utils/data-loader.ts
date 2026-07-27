import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, type ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { performance } from 'node:perf_hooks';

type Parser<TData> = (stream: ReadStream) => Promise<TData>;

export async function getParsedData<TData>(url: string, datasetName: string, cacheDir: string, parser: Parser<TData>): Promise<TData> {
  const stream = await loadDatasetData(url, datasetName, cacheDir);

  performance.mark('parseData_start');

  const output = await parser(stream);

  performance.mark('parseData_end');
  performance.measure(
    'parseData',
    'parseData_start',
    'parseData_end',
  );

  return output;
}

async function loadDatasetData(url: string, datasetName: string, cacheDir: string): Promise<ReadStream> {
  const filename = createHash('md5').update(url).digest('hex') + '.zip';
  const path = resolve(cacheDir, filename);

  if (!(await fs.stat(path).catch(() => {}))) {
    await fs.mkdir(cacheDir, { recursive: true });
    await downloadDatasetData(url, path, datasetName);
  }

  return createReadStream(path);
}

async function downloadDatasetData(url: string, path: string, datasetName: string) {
  console.log(`No ${datasetName} data found at ${path}, downloading from ${url}`);

  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to download from ${url}: ${response.statusText}`);

  await pipeline(
    Readable.fromWeb(response.body as any),
    createWriteStream(path, { flags: 'w+' }),
  );

  console.log(`${datasetName} data downloaded.`);
}
