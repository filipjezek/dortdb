import { DortDB, MapIndex } from '@dortdb/core';
import { resolve } from 'node:path';
import { prepareData } from './prepare-data.js';
import { isMainThread, workerData } from 'node:worker_threads';
import { BenchmarkWorkerOptions } from '../run-benchmark-worker.js';
import { DortDBDatabase } from '../databases/dortdb.js';
import { type QueryDef, QueryRegistry } from '../query.js';
import { TpchData } from '@dortdb/dataloaders';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/tpch/queries');
const QUERY_COUNT = 22;

if (!isMainThread) {
  await tpchBenchmark(workerData as BenchmarkWorkerOptions);
}

export default async function tpchBenchmark(options: BenchmarkWorkerOptions) {
  const db = DortDBDatabase.create();

  await db.setup(async () => {
    const data = await prepareData(options.dataUrl);
    registerDataSources(db.innerDb, data);
  });

  const registry = new QueryRegistry(QUERY_DIR, defineQueries());

  await registry.run(db, options.queryIds, options.runs, options.softTimeout);
}

function registerDataSources(db: DortDB, data: TpchData) {
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


function defineQueries(): QueryDef[] {
  return Array.from({ length: QUERY_COUNT }, (_, i) => ({
    filename: `q${i + 1}_dortdb.sql`,
    resultsFilename: `q${i + 1}_results.json`,
  }));
}
