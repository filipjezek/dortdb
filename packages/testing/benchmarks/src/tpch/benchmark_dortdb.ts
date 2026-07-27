import { DortDB, MapIndex } from '@dortdb/core';
import { datetime } from '@dortdb/datetime';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';
import { resolve } from 'node:path';
import { prepareData } from './prepare-data.js';
import { isMainThread, workerData } from 'node:worker_threads';
import { workerLog, setupPerformanceObserver } from '../utils/common.js';
import { BenchmarkWorkerOptions } from '../run-benchmark-worker.js';
import { DortDBDatabase } from '../databases/dortdb.js';
import { Query } from '../query.js';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/tpch/queries');

if (!isMainThread) {
  await tpchBenchmark(workerData as BenchmarkWorkerOptions);
}

export default async function tpchBenchmark(options: BenchmarkWorkerOptions) {
  setupPerformanceObserver();

  const db = DortDBDatabase.create();
  await registerDataSources(db.innerDb, options.measureInit);

  const id = options.query;
  const query = new Query(
    id,
    QUERY_DIR,
    `q${id}_dortdb.sql`,
    `q${id}_results.json`,
  );

  await query.run(db, options.softTimeout, options.runs);
}

async function registerDataSources(db: DortDB, measureInit: boolean) {
  const data = await prepareData();

  db.registerSource(['customer'], data.customer);
  db.registerSource(['lineitem'], data.lineitem);
  db.registerSource(['nation'], data.nation);
  db.registerSource(['orders'], data.orders);
  db.registerSource(['part'], data.part);
  db.registerSource(['partsupp'], data.partsupp);
  db.registerSource(['region'], data.region);
  db.registerSource(['supplier'], data.supplier);

  db.createIndex(['customer'], ['custkey'], MapIndex);
  db.createIndex(['customer'], ['nationkey'], MapIndex);
  db.createIndex(['lineitem'], ['orderkey'], MapIndex);
  db.createIndex(['lineitem'], ['partkey'], MapIndex);
  db.createIndex(['lineitem'], ['suppkey'], MapIndex);
  db.createIndex(['nation'], ['nationkey'], MapIndex);
  db.createIndex(['nation'], ['regionkey'], MapIndex);
  db.createIndex(['orders'], ['custkey'], MapIndex);
  db.createIndex(['orders'], ['orderkey'], MapIndex);
  db.createIndex(['part'], ['partkey'], MapIndex);
  db.createIndex(['partsupp'], ['partkey'], MapIndex);
  db.createIndex(['partsupp'], ['suppkey'], MapIndex);
  db.createIndex(['region'], ['regionkey'], MapIndex);
  db.createIndex(['supplier'], ['suppkey'], MapIndex);
  db.createIndex(['supplier'], ['nationkey'], MapIndex);
}
