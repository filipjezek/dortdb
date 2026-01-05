import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pickRandom } from '../utils/random.js';
import { datetime, DortDB, MapIndex } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { defaultRules } from '@dortdb/core/optimizer';
import { DomDataAdapter, XQuery } from '@dortdb/lang-xquery';
import { ConnectionIndex, Cypher } from '@dortdb/lang-cypher';
import { prepareData } from './prepare-data.js';
import { logger as parentLogger } from '../logger.js';
import pino from 'pino';
import {
  performance,
  PerformanceMeasure,
  PerformanceObserver,
} from 'node:perf_hooks';
import { Attr, Document, Element, Node } from 'slimdom';
import { createTreeWalker } from 'tasty-treewalker/src/TreeWalker-polyfill.js';
import { promiseTimeout } from '../utils/promise-timeout.js';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/unibench/queries');

export interface Query {
  filename: string;
  lang: 'sql' | 'xquery' | 'cypher';
  params?: Record<string, () => any>;
}

const queries: Query[] = [
  {
    filename: 'q01.txt',
    lang: 'sql',
    params: {
      customerId: () => pickRandom(personIds),
    },
  },
  {
    filename: 'q02.txt',
    lang: 'sql',
    params: {
      productId: () => pickRandom(productIds),
    },
  },
  {
    filename: 'q03.txt',
    lang: 'sql',
    params: {
      productId: () => pickRandom(productIds),
    },
  },
  {
    filename: 'q04.txt',
    lang: 'cypher',
  },
  {
    filename: 'q05.txt',
    lang: 'cypher',
    params: {
      personId: () => pickRandom(personIds),
      brand: () => pickRandom(brands),
    },
  },
  {
    filename: 'q06.txt',
    lang: 'sql',
    params: {
      customerId1: () => pickRandom(personIds),
      customerId2: () => pickRandom(personIds),
    },
  },
  {
    filename: 'q07.txt',
    lang: 'sql',
    params: {
      brand: () => pickRandom(brands),
    },
  },
  {
    filename: 'q08.txt',
    lang: 'sql',
    params: {
      industry: () => 'Sports',
    },
  },
  {
    filename: 'q08_noelement.txt',
    lang: 'xquery',
    params: {
      industry: () => 'Sports',
    },
  },
  {
    filename: 'q09.txt',
    lang: 'sql',
    params: {
      country: () => 'China',
    },
  },
  {
    filename: 'q10.txt',
    lang: 'sql',
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
Object.defineProperty(global, 'NodeFilter', {
  value: {
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2,
    FILTER_SKIP: 3,
    SHOW_ALL: 0xffffffff,
    SHOW_ELEMENT: 0x1,
    SHOW_ATTRIBUTE: 0x2,
    SHOW_TEXT: 0x4,
    SHOW_CDATA_SECTION: 0x8,
    SHOW_ENTITY_REFERENCE: 0x10,
    SHOW_ENTITY: 0x20,
    SHOW_PROCESSING_INSTRUCTION: 0x40,
    SHOW_COMMENT: 0x80,
    SHOW_DOCUMENT: 0x100,
    SHOW_DOCUMENT_TYPE: 0x200,
    SHOW_DOCUMENT_FRAGMENT: 0x400,
    SHOW_NOTATION: 0x800,
  },
});
Object.defineProperty(global, 'Node', { value: Node });
Object.defineProperty(global, 'Element', { value: Element });
Object.defineProperty(global, 'Attr', { value: Attr });
Object.defineProperty(Document.prototype, 'createTreeWalker', {
  value: createTreeWalker,
});

export async function unibenchBenchmark(): Promise<void> {
  const db = new DortDB({
    mainLang: SQL(),
    additionalLangs: [
      XQuery({ adapter: new DomDataAdapter(new Document()) }),
      Cypher({ defaultGraph: 'defaultGraph' }),
    ],
    extensions: [datetime],
    optimizer: { rules: defaultRules },
  });
  const logger = parentLogger.child({ name: 'unibench' });
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

  await registerDataSources(db, logger);
  for (const query of queries) {
    await runQuery(query, db, logger);
  }
}

async function runQuery(
  query: Query,
  db: DortDB,
  logger: pino.Logger,
): Promise<void> {
  const queryText = readFileSync(
    resolve(QUERY_DIR, query.filename),
    'utf-8',
  ).replaceAll('\r\n', '\n');
  console.log(new Date());
  console.log(`Running query: ${query.filename} (${query.lang})`);
  console.log(queryText);

  // warmup
  const now = Date.now();
  while (Date.now() - now < 30 * 1000) {
    db.query(queryText, {
      mainLang: query.lang,
      boundParams: Object.fromEntries(
        Object.entries(query.params || {}).map(([key, value]) => [
          key,
          value(),
        ]),
      ),
    });
  }

  for (let i = 0; i < 10; i++) {
    console.log(i);
    gc();
    const params = Object.fromEntries(
      Object.entries(query.params || {}).map(([key, value]) => [key, value()]),
    );
    if (i === 0)
      logger.info(
        { ...process.memoryUsage(), query: query.filename },
        'Memory usage before running query',
      );
    performance.mark(`runQuery_${query.filename}_start`);
    db.query(queryText, {
      mainLang: query.lang,
      boundParams: params,
    });
    performance.mark(`runQuery_${query.filename}_end`);
    performance.measure(`runQuery_${query.filename}`, {
      detail: { q: query.filename, params },
      start: `runQuery_${query.filename}_start`,
      end: `runQuery_${query.filename}_end`,
    });
    if (i === 0)
      logger.info(
        { ...process.memoryUsage(), query: query.filename },
        'Memory usage after running query',
      );
    await promiseTimeout(10000);
  }
}

async function registerDataSources(db: DortDB, logger: pino.Logger) {
  gc();
  logger.info(
    process.memoryUsage(),
    'Memory usage before registering data sources',
  );
  const data = await prepareData();

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

  logger.info(
    process.memoryUsage(),
    'Memory usage after registering data sources',
  );

  performance.mark('registerIndices_start');
  db.createIndex(['defaultGraph', 'nodes'], [], ConnectionIndex);
  db.createIndex(['defaultGraph', 'nodes'], ['x.id'], MapIndex, {
    mainLang: 'cypher',
    fromItemKey: ['x'],
  });
  db.createIndex(['defaultGraph', 'edges'], [], ConnectionIndex);
  db.createIndex(['customers'], ['id'], MapIndex);
  db.createIndex(['products'], ['productId'], MapIndex);
  db.createIndex(['products'], ['brand'], MapIndex);
  db.createIndex(['products'], ['asin'], MapIndex);
  db.createIndex(['feedback'], ['productAsin'], MapIndex);
  db.createIndex(['brandProducts'], ['brandName'], MapIndex);
  db.createIndex(['brandProducts'], ['productAsin'], MapIndex);
  db.createIndex(['vendors'], ['id'], MapIndex);
  db.createIndex(['posts'], ['id'], MapIndex);
  db.createIndex(['orders'], ['PersonId'], MapIndex);
  performance.mark('registerIndices_end');
  performance.measure(
    'registerIndices',
    'registerIndices_start',
    'registerIndices_end',
  );

  logger.info(process.memoryUsage(), 'Memory usage after registering indices');
}
