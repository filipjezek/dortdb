import { resolve } from 'node:path';
import fs from 'node:fs/promises';
import { prepareData } from './prepare-data.js';
import { isMainThread, workerData } from 'node:worker_threads';
import { BenchmarkWorkerOptions } from '../run-benchmark-worker.js';
import { AlaSQL, AlasqlDatabase } from '../databases/alasql.js';
import { type QueryDef, QueryRegistry } from '../query.js';
import { TpchData } from '@dortdb/dataloaders';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/tpch/queries');
const QUERY_COUNT = 22;
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

  const registry = new QueryRegistry(QUERY_DIR, defineQueries());

  await registry.run(db, options.queryIds, options.runs, options.softTimeout);
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
        columns.map((col) => row[col]),
      );
    }
  }
}

function defineQueries(): QueryDef[] {
  return Array.from({ length: QUERY_COUNT }, (_, i) => ({
    filename: `q${i + 1}_alasql.sql`,
    resultsFilename: `q${i + 1}_results.json`,
  }));
}
