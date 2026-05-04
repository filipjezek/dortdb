import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pickRandom } from '../utils/random.js';
import orientjs from 'orientjs';
import { isMainThread, workerData } from 'node:worker_threads';
import { BenchmarkWorkerOptions } from '../run-benchmark-worker.js';
import { workerLog } from '../utils/worker-log.js';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/unibench/queries');

export interface Query {
  filename: string;
  params?: Record<string, () => any>;
}

const queries: Query[] = [
  {
    filename: 'q01_orient.txt',
    params: {
      id: () => pickRandom(personIds),
    },
  },
  {
    filename: 'q02_orient.txt',
    params: {
      id: () => pickRandom(productIds),
    },
  },
  {
    filename: 'q03_orient.txt',
    params: {
      id: () => pickRandom(productIds),
    },
  },
  {
    filename: 'q04_orient.txt',
  },
  {
    filename: 'q05_orient.txt',
    params: {
      person: () => pickRandom(personIds),
      brand: () => pickRandom(brands),
    },
  },
  {
    filename: 'q06_orient.txt',
    params: {
      id1: () => pickRandom(personIds),
      id2: () => pickRandom(personIds),
    },
  },
  {
    filename: 'q07_orient.txt',
    params: {
      brand: () => pickRandom(brands),
    },
  },
  {
    filename: 'q08_orient.txt',
    params: {
      industry: () => 'Sports',
    },
  },
  {
    filename: 'q09_orient.txt',
  },
  {
    filename: 'q10_orient.txt',
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

async function prepareEnv(measureInit: boolean): Promise<orientjs.Db> {
  const dbserver = orientjs({
    host: 'localhost',
    port: 2424,
  });
  const db = dbserver.use({
    name: 'test',
    username: 'root',
    password: 'pass',
  });

  workerLog({}, 'Finished preparing environment');
  return db;
}

async function runQuery(
  query: Query,
  db: orientjs.Db,
  /** in seconds */
  totalTimeout: number,
  runs: number,
): Promise<void> {
  const queryText = readFileSync(
    resolve(QUERY_DIR, query.filename),
    'utf-8',
  ).replaceAll('\r\n', '\n');

  const now = Date.now();
  for (let i = 0; Date.now() - now < totalTimeout * 1000 && i < runs; i++) {
    await measureQueryRun(query, queryText, db, i, false, i === 0);
  }
}

async function measureQueryRun(
  query: Query,
  queryText: string,
  db: orientjs.Db,
  iteration: number,
  isWarmup: boolean,
  measureMemory: boolean,
) {
  const params = Object.fromEntries(
    Object.entries(query.params || {}).map(([key, value]) => [key, value()]),
  );
  performance.mark('query-start');
  const result = db.query(queryText, { params });
  await result.all();
  performance.mark('query-end');
  workerLog(
    {
      query: query.filename,
      params,
      iteration,
      isWarmup,
      durationNode: performance.measure(
        `query-${query.filename}-node`,
        'query-start',
        'query-end',
      ).duration,
    },
    'Executed query successfully',
  );
}

export default async function unibenchBenchmarkOrient(
  options: BenchmarkWorkerOptions,
) {
  const db = await prepareEnv(options.measureInit);
  await runQuery(
    queries[options.query - 1],
    db,
    options.softTimeout,
    options.runs,
  );
}

if (!isMainThread) {
  await unibenchBenchmarkOrient(workerData as BenchmarkWorkerOptions);
}
