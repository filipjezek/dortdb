import { resolve } from 'node:path';
import pino from 'pino';
import { readFileSync } from 'node:fs';
import { promiseTimeout } from '../utils/promise-timeout.js';
import { prepareData } from './prepare-data.js';
import alasql from 'alasql';
import { LOG_DIR } from '../logger.js';
import { substr } from '@dortdb/core/fns';
import { datetime } from '@dortdb/core';
import { PerformanceMeasure } from 'node:perf_hooks';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/tpch/queries');

export async function tpchBenchmarkAlaSQL(): Promise<void> {
  alasql.options.postgres = true;
  (alasql.options as any).dateAsString = false;
  alasql.options.cache = false;
  alasql.fn['substr'] = substr.impl;
  alasql.fn['date_interval'] = datetime.functions.find(
    (x) => x.name === 'interval',
  ).impl;
  alasql.fn['date_add'] = datetime.functions.find((x) => x.name === 'add').impl;
  alasql.fn['date_sub'] = datetime.functions.find((x) => x.name === 'sub').impl;
  alasql.fn['date_extract'] = datetime.functions.find(
    (x) => x.name === 'extract',
  ).impl;

  const logger = pino.pino(
    pino.transport({
      targets: [
        {
          target: 'pino/file',
          options: {
            destination: resolve(LOG_DIR, 'benchmark_alasql.4.log'),
            mkdir: true,
          },
        },
        {
          target: 'pino-pretty',
        },
      ],
    }),
  );
  const obs = new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
      logger.info(
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

  await registerDataSources(alasql, logger);
  for (let i = 20; i <= 20; i++) {
    if (i === 15) continue;
    await runQuery(i, alasql, logger);
  }
}

async function runQuery(
  query: number,
  db: typeof alasql,
  logger: pino.Logger,
): Promise<void> {
  const queryText = readFileSync(
    resolve(QUERY_DIR, `tpch-q${query}.sql`),
    'utf-8',
  )
    .replaceAll('\r\n', '\n')
    .replaceAll('date.add', 'date_add')
    .replaceAll('date.sub', 'date_sub')
    .replaceAll('date.extract', 'date_extract')
    .replaceAll('interval', 'date_interval');
  console.log(new Date());
  console.log(`Running query: tpch-q${query}.sql`);
  console.log(queryText);

  const now = Date.now();
  for (let i = 0; i < 10 && Date.now() - now < 15 * 60 * 1000; i++) {
    console.log(i);
    if (i === 0)
      logger.info(
        { ...process.memoryUsage(), query },
        'Memory usage before running query',
      );
    performance.mark(`runQuery_${query}_start`);
    db(queryText);

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

async function registerDataSources(db: typeof alasql, logger: pino.Logger) {
  const data = await prepareData();

  db(`
CREATE TABLE region (
    regionkey INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    comment TEXT
);
CREATE TABLE nation (
    nationkey INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    regionkey INTEGER NOT NULL,
    comment TEXT,
    FOREIGN KEY (regionkey) REFERENCES region(regionkey)
);
CREATE TABLE supplier (
    suppkey INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    nationkey INTEGER NOT NULL,
    phone TEXT,
    acctbal REAL,
    comment TEXT,
    FOREIGN KEY (nationkey) REFERENCES nation(nationkey)
);
CREATE TABLE part (
    partkey INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    mfgr TEXT,
    brand TEXT,
    type TEXT,
    size INTEGER,
    container TEXT,
    retailprice REAL,
    comment TEXT
);
CREATE TABLE partsupp (
    partkey INTEGER NOT NULL,
    suppkey INTEGER NOT NULL,
    availqty INTEGER,
    supplycost REAL,
    comment TEXT,
    PRIMARY KEY (partkey, suppkey),
    FOREIGN KEY (partkey) REFERENCES part(partkey),
    FOREIGN KEY (suppkey) REFERENCES supplier(suppkey)
);
CREATE TABLE customer (
    custkey INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    nationkey INTEGER NOT NULL,
    phone TEXT,
    acctbal REAL,
    mktsegment TEXT,
    comment TEXT,
    FOREIGN KEY (nationkey) REFERENCES nation(nationkey)
);
CREATE TABLE orders (
    orderkey INTEGER PRIMARY KEY,
    custkey INTEGER NOT NULL,
    orderstatus TEXT,
    totalprice REAL,
    orderdate INTEGER,
    orderpriority TEXT,
    clerk TEXT,
    shippriority INTEGER,
    comment TEXT,
    FOREIGN KEY (custkey) REFERENCES customer(custkey)
);
CREATE TABLE lineitem (
    orderkey INTEGER NOT NULL,
    partkey INTEGER NOT NULL,
    suppkey INTEGER NOT NULL,
    linenumber INTEGER NOT NULL,
    quantity REAL,
    extendedprice REAL,
    discount REAL,
    tax REAL,
    returnflag TEXT,
    linestatus TEXT,
    shipdate INTEGER,
    commitdate INTEGER,
    receiptdate INTEGER,
    shipinstruct TEXT,
    shipmode TEXT,
    comment TEXT,
    PRIMARY KEY (orderkey, linenumber),
    FOREIGN KEY (orderkey) REFERENCES orders(orderkey),
    FOREIGN KEY (partkey, suppkey) REFERENCES partsupp(partkey, suppkey)
);

CREATE INDEX idx_nation_regionkey ON nation(regionkey);
CREATE INDEX idx_supplier_nationkey ON supplier(nationkey);
CREATE INDEX idx_partsupp_partkey ON partsupp(partkey);
CREATE INDEX idx_partsupp_suppkey ON partsupp(suppkey);
CREATE INDEX idx_customer_nationkey ON customer(nationkey);
CREATE INDEX idx_orders_custkey ON orders(custkey);
CREATE INDEX idx_lineitem_partkey ON lineitem(partkey);
CREATE INDEX idx_lineitem_suppkey ON lineitem(suppkey);
CREATE INDEX idx_lineitem_partkey_suppkey ON lineitem(partkey, suppkey);
  `);

  for (const table of [
    'region',
    'nation',
    'supplier',
    'part',
    'partsupp',
    'customer',
    'orders',
    'lineitem',
  ] as const) {
    console.log(`Inserting data into ${table}`);
    const rows = data[table];
    const columns = Object.keys(rows[0]);
    const placeholders = Object.keys(rows[0])
      .map(() => '?')
      .join(', ');
    for (const row of rows) {
      db(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        columns.map((col) => {
          const val = row[col];
          if (val instanceof Date) return val.getTime();
          return val;
        }),
      );
    }
  }
}
