import { resolve } from 'node:path';
import fs from 'node:fs/promises';
import { prepareData } from './data.js';
import { isMainThread, workerData } from 'node:worker_threads';
import { BenchmarkWorkerOptions } from '../run-benchmark-worker.js';
import { SqliteDatabase, type SqliteDB } from '../databases/sqlite.js';
import { type QueryDef, QueryRegistry } from '../query.js';
import { TpchData } from '@dortdb/dataloaders';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/tpch/queries');
const QUERY_COUNT = 22;
const SCHEMA_FILE = resolve(QUERY_DIR, 'schema_sqlite.sql');

if (!isMainThread) {
  await tpchBenchmarkSQLite(workerData as BenchmarkWorkerOptions);
}

export default async function tpchBenchmarkSQLite(options: BenchmarkWorkerOptions) {
  const db = await SqliteDatabase.create();

  await db.setup(async () => {
    const data = await prepareData(options.dataUrl);
    await registerDataSources(db.innerDb, data);
  });

  const registry = new QueryRegistry(QUERY_DIR, defineQueries());

  await registry.run(db, options.queryIds, options.runs, options.softTimeout);
}

async function registerDataSources(db: SqliteDB, data: TpchData) {
  const schema = await fs.readFile(SCHEMA_FILE, 'utf-8');
  db.run(schema);

  for (const [table, rows] of Object.entries(data)) {
    const columns = Object.keys(rows[0]);
    const placeholders = Object.keys(rows[0]).map(() => '?').join(', ');

    const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);

    for (const row of rows) {
      stmt.run(
        columns.map((col) => {
          const val = row[col];
          if (val instanceof Date)
            return `${val.getFullYear()}-${(val.getMonth() + 1).toString().padStart(2, '0')}-${val.getDate().toString().padStart(2, '0')}`;

          return val;
        }),
      );
    }
    stmt.free();
  }
}

function defineQueries(): QueryDef[] {
  return Array.from({ length: QUERY_COUNT }, (_, i) => ({
    filename: `q${i + 1}_sqlite.sql`,
    resultsFilename: `q${i + 1}_results.json`,
  }));
}
