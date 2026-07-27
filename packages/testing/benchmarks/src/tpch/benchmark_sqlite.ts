import { resolve } from 'node:path';
import fs from 'node:fs/promises';
import { prepareData } from './prepare-data.js';
import { isMainThread, workerData } from 'node:worker_threads';
import { workerLog, setupPerformanceObserver } from '../utils/common.js';
import { BenchmarkWorkerOptions } from '../run-benchmark-worker.js';
import { SqliteDatabase, type SqliteDB } from '../databases/sqlite.js';
import { Query } from '../query.js';
import { TpchData } from '@dortdb/dataloaders';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/tpch/queries');
const SCHEMA_FILE = resolve(QUERY_DIR, 'schema_sqlite.sql');

if (!isMainThread) {
  await tpchBenchmarkSQLite(workerData as BenchmarkWorkerOptions);
}

export default async function tpchBenchmarkSQLite(options: BenchmarkWorkerOptions) {
  setupPerformanceObserver();

  const db = await SqliteDatabase.create();

  const data = await prepareData(options.dataUrl);
  await registerDataSources(db.innerDb, data);
  workerLog('Finished preparing environment');

  const id = options.query;
  const query = new Query(
    id,
    QUERY_DIR,
    `q${id}_sqlite.sql`,
    `q${id}_results.json`,
  );

  await query.run(db, options.softTimeout, options.runs);
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
