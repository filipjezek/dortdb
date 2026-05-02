import { datetime, DortDB, MapIndex } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { prepareData } from './prepare-data.js';
import { PerformanceMeasure } from 'node:perf_hooks';
import { isMainThread, workerData } from 'node:worker_threads';
import { workerLog } from '../utils/worker-log.js';
import { BenchmarkWorkerOptions } from '../run-benchmark-worker.js';
import { promiseTimeout } from '../utils/promise-timeout.js';
import { deepEqual } from '../utils/deep-equal.js';
import { diff } from '@vitest/utils/diff';
import { getExpectedResult } from './get-expected.js';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/tpch/queries');

async function prepareEnv(measureInit: boolean): Promise<DortDB> {
  const db = new DortDB({
    mainLang: SQL(),
    extensions: [datetime],
    optimizer: { rules: defaultRules },
    executor: { hashJoinIndices: [MapIndex] },
  });
  const obs = new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
      workerLog(
        {
          duration: entry.duration,
          name: entry.name,
          detail: (entry as PerformanceMeasure).detail,
        },
        'Performance entry',
      );
    });
  });
  obs.observe({ entryTypes: ['measure'], buffered: false });

  workerLog({}, 'Preparing environment');
  await registerDataSources(db, measureInit);
  workerLog({}, 'Finished preparing environment');
  return db;
}

async function runQuery(
  query: number,
  db: DortDB,
  /** in seconds */
  totalTimeout: number,
  runs: number,
  skipWarmup: boolean,
): Promise<void> {
  const queryText = readFileSync(
    resolve(QUERY_DIR, `tpch-q${query}.sql`),
    'utf-8',
  ).replaceAll('\r\n', '\n');
  const expectedResult = getExpectedResult(query);
  console.log(new Date());
  console.log(`Running query: tpch-q${query}.sql`);
  console.log(queryText);

  const now = Date.now();
  if (!skipWarmup) {
    for (let i = 0; Date.now() - now < 30 * 1000 && i < 5; i++) {
      await measureQueryRun(
        query,
        queryText,
        db,
        i,
        true,
        i === 0,
        expectedResult,
      );
    }
  }

  for (let i = 0; Date.now() - now < totalTimeout * 1000 && i < runs; i++) {
    await measureQueryRun(
      query,
      queryText,
      db,
      i,
      false,
      i === 0,
      expectedResult,
    );
  }
}

async function measureQueryRun(
  query: number,
  queryText: string,
  db: DortDB,
  iteration: number,
  isWarmup: boolean,
  measureMemory: boolean,
  expectedResult?: any,
) {
  gc();
  if (measureMemory) {
    workerLog(
      { ...process.memoryUsage(), query, iteration, isWarmup },
      'Memory usage before running query',
    );
  }
  await promiseTimeout(1000);
  performance.mark(`runQuery_${query}_start`);
  const res = db.query(queryText);

  performance.mark(`runQuery_${query}_end`);
  performance.measure(`runQuery_${query}`, {
    detail: { q: query, iteration, isWarmup },
    start: `runQuery_${query}_start`,
    end: `runQuery_${query}_end`,
  });
  if (measureMemory) {
    workerLog(
      { ...process.memoryUsage(), query, iteration, isWarmup },
      'Memory usage after running query',
    );
  }

  if (expectedResult) {
    if (deepEqual(res.data, expectedResult)) {
      workerLog(
        { query, iteration, isWarmup },
        'Query result matches expected result',
      );
    } else {
      workerLog(
        {
          query,
          iteration,
          isWarmup,
          expected: expectedResult,
          actual: res.data,
        },
        'Query result does NOT match expected result',
      );
      console.log(
        diff(expectedResult, res.data, {
          aAnnotation: 'expected',
          bAnnotation: 'actual',
        }),
      );
    }
  }
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

export default async function tpchBenchmark(options: BenchmarkWorkerOptions) {
  const db = await prepareEnv(options.measureInit);
  await runQuery(
    options.query,
    db,
    options.softTimeout,
    options.runs,
    options.skipWarmup,
  );
}

if (!isMainThread) {
  await tpchBenchmark(workerData as BenchmarkWorkerOptions);
}
