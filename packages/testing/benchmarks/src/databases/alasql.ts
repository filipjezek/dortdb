import { Database, type SqlObject } from '../database.js';
import { QueryParams } from '../query.js';
import alasqlRaw from 'alasql';
import { substr } from '@dortdb/core/fns';
import { datetime } from '@dortdb/datetime';

// This is ugly but alasql uses commonjs modules and interface augmentation doesn't work.
export type AlaSQL = typeof alasqlRaw & {
  compile<T = unknown>(sql: string): (...params: any[]) => T;
};

const alasql = alasqlRaw as AlaSQL;

export class AlasqlDatabase extends Database<SqlObject[]> {
  constructor(
    readonly innerDb: AlaSQL
  ) {
    super();
  }

  override async query(content: string, params?: QueryParams) {
    return this.innerDb<SqlObject[]>(content, params);
  }

  override extractResults(result: SqlObject[]): SqlObject[] {
    return result;
  }

  private static isSetup = false;

  static create(): AlasqlDatabase {
    const innerDb = alasql;
    if (!this.isSetup) {
      setupAlasql(innerDb);
      this.isSetup = true;
    }

    // NICE_TO_HAVE Not ideal to use the global alasql instance but let's hope that the benchmarks are single-threaded and that we don't have to run multiple benchmarks in parallel.
    return new AlasqlDatabase(innerDb);
  }
}

function setupAlasql(alasql: AlaSQL) {
  alasql.options.postgres = true;
  (alasql.options as any).dateAsString = false;
  alasql.options.cache = false;
  alasql.fn['substr'] = substr.impl;
  alasql.fn['date_interval'] = datetime.functions.find(x => x.name === 'interval').impl;
  alasql.fn['date_add'] = datetime.functions.find(x => x.name === 'add').impl;
  alasql.fn['date_sub'] = datetime.functions.find(x => x.name === 'sub').impl;
  alasql.fn['date_extract'] = datetime.functions.find(x => x.name === 'extract').impl;
}
