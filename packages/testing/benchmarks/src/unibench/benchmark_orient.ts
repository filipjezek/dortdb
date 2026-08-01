import { resolve } from 'node:path';
import { pickRandom } from '../utils/common.js';
import { isMainThread, workerData } from 'node:worker_threads';
import { BenchmarkWorkerOptions } from '../run-benchmark-worker.js';
import { brands, personIds, productIds } from './data.js';
import { type QueryDef, QueryRegistry } from '../query.js';
import { OrientDatabase } from '../databases/orient.js';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/unibench/queries');

if (!isMainThread) {
  await unibenchBenchmarkOrient(workerData as BenchmarkWorkerOptions);
}

export default async function unibenchBenchmarkOrient(options: BenchmarkWorkerOptions) {
  const db = OrientDatabase.create();

  await db.setup();

  const registry = new QueryRegistry(QUERY_DIR, defineQueries());

  await registry.run(db, options.queryIds, options.runs, options.softTimeout);

  await db.innerDb.close();
}

function defineQueries(): QueryDef[] {
  return [ {
    filename: 'q1_orient.txt',
    params: {
      id: () => pickRandom(personIds),
    },
  }, {
    filename: 'q2_orient.txt',
    params: {
      id: () => pickRandom(productIds),
    },
  }, {
    filename: 'q3_orient.txt',
    params: {
      id: () => pickRandom(productIds),
    },
  }, {
    filename: 'q4_orient.txt',
  }, {
    filename: 'q5_orient.txt',
    params: {
      person: () => pickRandom(personIds),
      brand: () => pickRandom(brands),
    },
  }, {
    filename: 'q6_orient.txt',
    params: {
      id1: () => pickRandom(personIds),
      id2: () => pickRandom(personIds),
    },
  }, {
    filename: 'q7_orient.txt',
    params: {
      brand: () => pickRandom(brands),
    },
  }, {
    filename: 'q8_orient.txt',
    params: {
      industry: () => 'Sports',
    },
  }, {
    filename: 'q9_orient.txt',
  }, {
    filename: 'q10_orient.txt',
  } ];
}
