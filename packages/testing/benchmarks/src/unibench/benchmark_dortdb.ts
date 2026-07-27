import { resolve } from 'node:path';
import { pickRandom, setupPerformanceObserver, workerLog } from '../utils/common.js';
import { DortDB, MapIndex } from '@dortdb/core';
import { ConnectionIndex } from '@dortdb/lang-cypher';
import { prepareData } from './prepare-data.js';
import { performance } from 'node:perf_hooks';
import { isMainThread, workerData } from 'node:worker_threads';
import { BenchmarkWorkerOptions } from '../run-benchmark-worker.js';
import { brands, personIds, productIds } from './data.js';
import { Query, QueryDef } from '../query.js';
import { DortDBDatabase } from '../databases/dortdb.js';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/unibench/queries');

if (!isMainThread) {
  await unibenchBenchmark(workerData as BenchmarkWorkerOptions);
}

export default async function unibenchBenchmark(options: BenchmarkWorkerOptions) {
  setupPerformanceObserver();

  const db = DortDBDatabase.create();
  await registerDataSources(db.innerDb, options.secondaryIndexes, options.measureInit);

  workerLog('Finished preparing environment');

  const id = options.query;
  const def = defineQueries()[id - 1];
  const query = new Query(
    id,
    QUERY_DIR,
    def.filename,
    undefined,
    def.params,
  );

  await query.run(
    db,
    options.softTimeout,
    options.runs,
    options.skipWarmup,
  );
}

async function registerDataSources(db: DortDB, secondaryIndexes: boolean, measureInit: boolean) {
  if (measureInit) {
    gc();
    workerLog('Memory usage before registering data sources', process.memoryUsage())
  }

  const data = await prepareData();

  if (measureInit)
    gc();

  db.registerSource(['customers'], data.customers);
  db.registerSource(['products'], data.products);
  db.registerSource(['feedback'], data.feedback);
  db.registerSource(['orders'], data.orders);
  db.registerSource(['Invoices'], data.invoices);
  db.registerSource(['defaultGraph'], data.socialNetwork);
  db.registerSource(['brandProducts'], data.brandProducts);
  db.registerSource(['posts'], data.posts);
  db.registerSource(['vendors'], data.vendors);

  if (measureInit) {
    workerLog('Memory usage after registering data sources', process.memoryUsage());
    performance.mark('registerIndexes_start');
  }

  db.createIndex(['defaultGraph', 'nodes'], [], ConnectionIndex);
  db.createIndex(['defaultGraph', 'nodes'], ['x.id'], MapIndex, {
    mainLang: 'cypher',
    fromItemKey: ['x'],
  });
  db.createIndex(['defaultGraph', 'edges'], [], ConnectionIndex);
  db.createIndex(['customers'], ['id'], MapIndex);
  db.createIndex(['products'], ['productId'], MapIndex);
  db.createIndex(['vendors'], ['id'], MapIndex);
  db.createIndex(['posts'], ['id'], MapIndex);
  db.createIndex(['orders'], ['OrderId'], MapIndex);

  if (secondaryIndexes) {
    db.createIndex(['products'], ['brand'], MapIndex);
    db.createIndex(['products'], ['asin'], MapIndex);
    db.createIndex(['brandProducts'], ['productAsin'], MapIndex);
    db.createIndex(['brandProducts'], ['brandName'], MapIndex);
    db.createIndex(['feedback'], ['productAsin'], MapIndex);
    db.createIndex(['feedback'], ['personId'], MapIndex);
    db.createIndex(['orders'], ['PersonId'], MapIndex);
  }

  if (measureInit) {
    performance.mark('registerIndexes_end');
    performance.measure(
      'registerIndexes',
      'registerIndexes_start',
      'registerIndexes_end',
    );

    workerLog('Memory usage after registering indexes', process.memoryUsage());
  }
}

function defineQueries(): QueryDef[] {
  return [ {
    filename: 'q1_dortdb.txt',
    params: {
      customerId: () => pickRandom(personIds),
    },
  }, {
    filename: 'q2_dortdb.txt',
    params: {
      productId: () => pickRandom(productIds),
    },
  }, {
    filename: 'q3_dortdb.txt',
    params: {
      productId: () => pickRandom(productIds),
    },
  }, {
    filename: 'q4_dortdb.txt',
  }, {
    filename: 'q5_dortdb.txt',
    params: {
      personId: () => pickRandom(personIds),
      brand: () => pickRandom(brands),
    },
  }, {
    filename: 'q6_dortdb.txt',
    params: {
      customerId1: () => pickRandom(personIds),
      customerId2: ({ customerId1 }) => {
        let id2 = pickRandom(personIds);
        while (id2 === customerId1) {
          id2 = pickRandom(personIds);
        }
        return id2;
      },
    },
  }, {
    filename: 'q7_dortdb.txt',
    params: {
      brand: () => pickRandom(brands),
    },
  }, {
    filename: 'q8_dortdb.txt',
    params: {
      industry: () => 'Sports',
    },
  }, {
    filename: 'q9_dortdb.txt',
    params: {
      country: () => 'China',
    },
  }, {
    filename: 'q10_dortdb.txt',
  }, {
    filename: 'q4_naive.txt',
  } ];
}
