import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pickRandom } from '../utils/random.js';
import { logger as parentLogger } from '../logger.js';
import pino from 'pino';
import { promiseTimeout } from '../utils/promise-timeout.js';
import { Database } from 'arangojs';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/unibench/queries');

export interface Query {
  filename: string;
  params?: Record<string, () => any>;
}

const queries: Query[] = [
  {
    filename: 'q01_arango.txt',
    params: {
      key: () => pickRandom(personIds),
    },
  },
  {
    filename: 'q02_arango.txt',
    params: {
      key: () => pickRandom(productIds),
    },
  },
  {
    filename: 'q03_arango.txt',
    params: {
      id: () => 'Product/' + pickRandom(productIds),
    },
  },
  {
    filename: 'q04_arango.txt',
  },
  {
    filename: 'q05_arango.txt',
    params: {
      id: () => 'Customer/' + pickRandom(personIds),
      brand: () => pickRandom(brands),
    },
  },
  {
    filename: 'q06_arango.txt',
    params: {
      customerOne: () => 'Customer/' + pickRandom(personIds),
      customerTwo: () => 'Customer/' + pickRandom(personIds),
    },
  },
  {
    filename: 'q07_arango.txt',
    params: {
      brand: () => pickRandom(brands),
    },
  },
  {
    filename: 'q08_arango.txt',
    params: {
      industry: () => 'Sports',
    },
  },
  {
    filename: 'q09_arango.txt',
  },
  {
    filename: 'q10_arango.txt',
  },
];

const brands = [
  'Anta_Sports',
  'Atletica',
  'EA_Sports',
  'POC_Sports',
  'Derbi',
  'Arcteryx',
  'Reebok',
  'Karhu_(sports_brand)',
  'Signia_(sportswear)',
  'Li-Ning',
  'Elan_Snowboards',
  'Wilson_Sporting_Goods',
  'Peak_Sport_Products',
  'Onda_(sportswear)',
  'ASICS',
  'ERKE_(brand)',
  'TRYMAX',
  'Kappa_(company)',
  'Topper_(sports)',
  'Nike',
];
const personIds = [
  30786325582980, 24189255818770, 10995116277924, 991, 2846, 13194139539556,
  30786325586221, 19791209307179, 26388279076194, 15393162792830,
  26388279074667, 28587302329888, 9137, 6597069773166, 6597069777629,
  10995116285328, 26388279072865, 15393162794965, 4398046512286, 13194139539667,
];
const productIds = [
  8188, 4403, 2069, 5085, 1342, 7252, 9033, 6037, 1909, 5396, 2390, 3000, 9206,
  3393, 6107, 1679, 4055, 7603, 7878,
];

export async function unibenchBenchmarkArango(): Promise<void> {
  const logger = parentLogger.child({ name: 'unibench' });
  const db = new Database();

  for (const query of queries) {
    await runQuery(query, db, logger);
  }
}

async function runQuery(
  query: Query,
  db: Database,
  logger: pino.Logger,
): Promise<void> {
  const queryText = readFileSync(
    resolve(QUERY_DIR, query.filename),
    'utf-8',
  ).replaceAll('\r\n', '\n');

  for (let i = 0; i < 10; i++) {
    const params = Object.fromEntries(
      Object.entries(query.params || {}).map(([key, value]) => [key, value()]),
    );
    performance.mark('query-start');
    const result = await db.query(queryText, params, { cache: false });
    await result.all();
    performance.mark('query-end');
    logger.info(
      {
        query: query.filename,
        params,
        duration: result.extra.stats.executionTime * 1000, // Convert to milliseconds
        memory: result.extra.stats.peakMemoryUsage,
        durationNode: performance.measure(
          `query-${query.filename}-node`,
          'query-start',
          'query-end',
        ).duration,
      },
      'Executed query successfully',
    );
    await promiseTimeout(100);
  }
}
