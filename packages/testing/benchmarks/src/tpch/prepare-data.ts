import { resolve } from 'node:path';
import fs from 'node:fs/promises';
import { CSVParser, toArray, TPCHData, tpchFiles } from '@dortdb/dataloaders';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

export const DATA_DIR = resolve(import.meta.dirname, '../../dist/data/tpch');

export async function prepareData() {
  if (!(await fs.stat(DATA_DIR).catch(() => {}))) {
    throw new Error(`Data directory does not exist: ${DATA_DIR}`);
  }
  return parseTPCHData();
}

export async function parseTPCHData(): Promise<TPCHData> {
  const result: TPCHData = {} as any;
  for (const file of Object.keys(tpchFiles)) {
    const filePath = resolve(DATA_DIR, file);
    const data = Readable.toWeb(
      createReadStream(filePath, 'utf-8'),
    ).pipeThrough(
      new CSVParser({
        cast: true,
        castDate: true,
        columns: tpchFiles[file].csvOptions.columns,
        delimiter: tpchFiles[file].csvOptions.separator,
      }),
    );
    result[tpchFiles[file].key as keyof TPCHData] = await toArray(data);
  }
  return result;
}
