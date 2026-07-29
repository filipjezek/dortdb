import { resolve } from 'node:path';
import { pickRandom } from '../utils/common.js';
import { isMainThread, workerData } from 'node:worker_threads';
import { BenchmarkWorkerOptions } from '../run-benchmark-worker.js';
import { brands, personIds, productIds } from './data.js';
import { type QueryDef, QueryRegistry } from '../query.js';
import { ArangoDatabase } from '../databases/arango.js';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/unibench/queries');

if (!isMainThread) {
  await unibenchBenchmarkArango(workerData as BenchmarkWorkerOptions);
}

export default async function unibenchBenchmarkArango(options: BenchmarkWorkerOptions) {
  const db = ArangoDatabase.create();

  await db.setup();

  const registry = new QueryRegistry(QUERY_DIR, defineQueries());

  await registry.run(db, options.queryIds, options.runs, options.softTimeout);
}

function defineQueries(): QueryDef[] {
  return [ {
    filename: 'q1_arango.txt',
    params: {
      key: () => pickRandom(personIds),
    },
  }, {
    filename: 'q2_arango.txt',
    params: {
      key: () => pickRandom(productIds),
    },
  }, {
    filename: 'q3_arango.txt',
    params: {
      id: () => 'Product/' + pickRandom(productIds),
    },
  }, {
    filename: 'q4_arango.txt',
  }, {
    filename: 'q5_arango.txt',
    params: {
      id: () => 'Customer/' + pickRandom(personIds),
      brand: () => pickRandom(brands),
    },
  }, {
    filename: 'q6_arango.txt',
    params: {
      customerOne: () => 'Customer/' + pickRandom(personIds),
      customerTwo: () => 'Customer/' + pickRandom(personIds),
    },
  }, {
    filename: 'q7_arango.txt',
    params: {
      brand: () => pickRandom(brands),
    },
  }, {
    filename: 'q8_arango.txt',
    params: {
      industry: () => 'Sports',
    },
  }, {
    filename: 'q9_arango.txt',
  }, {
    filename: 'q10_arango.txt',
  } ];
}
