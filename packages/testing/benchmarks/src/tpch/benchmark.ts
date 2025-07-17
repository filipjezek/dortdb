import { datetime, DortDB, MapIndex } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';
import { resolve } from 'node:path';
import pino from 'pino';
import { logger as parentLogger } from '../logger.js';
import { readFileSync } from 'node:fs';
import { promiseTimeout } from '../utils/promise-timeout.js';
import { prepareData } from './prepare-data.js';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/tpch/queries');

export async function tpchBenchmark(): Promise<void> {
  const db = new DortDB({
    mainLang: SQL(),
    extensions: [datetime],
    optimizer: { rules: defaultRules },
  });
  const logger = parentLogger.child({ module: 'tpch' });
  const obs = new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
      logger.info(
        { duration: entry.duration, name: entry.name, detail: entry.detail },
        'Performance entry',
      );
    });
  });
  obs.observe({ entryTypes: ['measure'], buffered: false });

  await registerDataSources(db, logger);
  for (let i = 19; i <= 22; i++) {
    if (i === 15 || i === 13) continue;
    await runQuery(i, db, logger);
  }
}

async function runQuery(
  query: number,
  db: DortDB,
  logger: pino.Logger,
): Promise<void> {
  const queryText = readFileSync(
    resolve(QUERY_DIR, `tpch-q${query}.sql`),
    'utf-8',
  ).replaceAll('\r\n', '\n');
  console.log(new Date());
  console.log(`Running query: tpch-q${query}.sql`);
  console.log(queryText);

  const now = Date.now();
  for (let i = 0; i < 10 && Date.now() - now < 15 * 60 * 1000; i++) {
    console.log(i);
    gc();
    if (i === 0)
      logger.info(
        { ...process.memoryUsage(), query },
        'Memory usage before running query',
      );
    performance.mark(`runQuery_${query}_start`);
    db.query(queryText);

    performance.mark(`runQuery_${query}_end`);
    performance.measure(`runQuery_${query}`, {
      detail: { q: query },
      start: `runQuery_${query}_start`,
      end: `runQuery_${query}_end`,
    });
    if (i === 0)
      logger.info(
        { ...process.memoryUsage(), query },
        'Memory usage after running query',
      );
    await promiseTimeout(1000);
  }
}

async function registerDataSources(db: DortDB, logger: pino.Logger) {
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
