import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, type ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { performance } from 'node:perf_hooks';
import { Events, workerLog } from './logger.js';

type Parser<TData> = (stream: ReadStream) => Promise<TData>;

export async function getParsedData<TData>(url: string, benchmark: string, cacheDir: string, parser: Parser<TData>): Promise<TData> {
  const stream = await loadBenchmarkData(url, benchmark, cacheDir);

  const start = performance.now();
  const output = await parser(stream);
  const duration = performance.now() - start;

  workerLog(Events.dataParsed, 'Data parsed', { url, duration });

  return output;
}

async function loadBenchmarkData(url: string, benchmark: string, cacheDir: string): Promise<ReadStream> {
  const filename = createHash('md5').update(url).digest('hex') + '.zip';
  const path = resolve(cacheDir, filename);

  if (!(await fs.stat(path).catch(() => {}))) {
    await fs.mkdir(cacheDir, { recursive: true });
    await downloadBenchmarkData(url, path, benchmark);
  }

  return createReadStream(path);
}

async function downloadBenchmarkData(url: string, path: string, benchmark: string) {
  console.log(`No ${benchmark} data found at ${path}, downloading from ${url}`);

  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to download from ${url}: ${response.statusText}`);

  await pipeline(
    Readable.fromWeb(response.body as any),
    createWriteStream(path, { flags: 'w+' }),
  );

  console.log(`${benchmark} data downloaded.`);
}
