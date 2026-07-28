import { resolve } from 'node:path';
import fs from 'node:fs/promises';
import { prepareData } from './prepare-data.js';
import { isMainThread, workerData } from 'node:worker_threads';
import { BenchmarkWorkerOptions } from '../run-benchmark-worker.js';
import { AlaSQL, AlasqlDatabase } from '../databases/alasql.js';
import { Query } from '../query.js';
import { TpchData } from '@dortdb/dataloaders';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/tpch/queries');
const SCHEMA_FILE = resolve(QUERY_DIR, 'schema_alasql.sql');

if (!isMainThread) {
  await tpchBenchmarkAlaSQL(workerData as BenchmarkWorkerOptions);
}

export default async function tpchBenchmarkAlaSQL(options: BenchmarkWorkerOptions) {
  const db = AlasqlDatabase.create();

  await db.setup(async () => {
    const data = await prepareData(options.dataUrl);
    await registerDataSources(db.innerDb, data);
  });

  const id = options.query;
  const query = new Query(
    id,
    QUERY_DIR,
    `q${id}_alasql.sql`,
    `q${id}_results.json`,
  );

  await query.run(db, options.softTimeout, options.runs);
}

async function registerDataSources(db: AlaSQL, data: TpchData) {
  const schema = await fs.readFile(SCHEMA_FILE, 'utf-8');
  db(schema);

  for (const table of [
    'region',
    'nation',
    'supplier',
    'part',
    'partsupp',
    'customer',
    'orders',
    'lineitem',
  ] as const) {
    console.log(`Inserting data into ${table}`);

    const rows = data[table];
    const columns = Object.keys(rows[0]);
    const placeholders = Object.keys(rows[0]).map(() => '?').join(', ');

    for (const row of rows) {
      db(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        columns.map((col) => {
          const val = row[col];
          if (val instanceof Date) return val.getTime();
          return val;
        }),
      );
    }
  }
}
