import { resolve } from 'node:path';
import { pickRandom } from '../utils/common.js';
import { DortDB, MapIndex } from '@dortdb/core';
import { ConnectionIndex } from '@dortdb/lang-cypher';
import { prepareData } from './prepare-data.js';
import { isMainThread, workerData } from 'node:worker_threads';
import { BenchmarkWorkerOptions } from '../run-benchmark-worker.js';
import { brands, personIds, productIds } from './data.js';
import { type QueryDef, QueryRegistry } from '../query.js';
import { DortDBDatabase } from '../databases/dortdb.js';
import { UnibenchData } from '@dortdb/dataloaders';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/unibench/queries');

if (!isMainThread) {
  await unibenchBenchmark(workerData as BenchmarkWorkerOptions);
}

export default async function unibenchBenchmark(options: BenchmarkWorkerOptions) {
  const db = DortDBDatabase.create(options.dortdb.excludeRules);

  await db.setup(async () => {
    const data = await prepareData(options.dataUrl);
    registerDataSources(db.innerDb, data, options.unibench.secondaryIndexes);
  });

  const registry = new QueryRegistry(QUERY_DIR, defineQueries());

  await registry.run(db, options.queryIds, options.runs, options.softTimeout);
}

function registerDataSources(db: DortDB, data: UnibenchData, secondaryIndexes: boolean) {
  db.registerSource(['customers'], data.customers);
  db.registerSource(['products'], data.products);
  db.registerSource(['feedback'], data.feedback);
  db.registerSource(['orders'], data.orders);
  db.registerSource(['Invoices'], data.invoices);
  db.registerSource(['defaultGraph'], data.socialNetwork);
  db.registerSource(['brandProducts'], data.brandProducts);
  db.registerSource(['posts'], data.posts);
  db.registerSource(['vendors'], data.vendors);

  db.createIndex(['defaultGraph', 'nodes'], [], ConnectionIndex);
  db.createIndex(['defaultGraph', 'nodes'], ['x.id'], MapIndex, { mainLang: 'cypher', fromItemKey: ['x'] });
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
