import { resolve } from 'node:path';
import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import type { Database, SqlObject, SqlValue } from './database.js';
import { deepEqual, promiseTimeout, workerLog } from './utils/common.js';
import { diff } from '@vitest/utils/diff';

export type QueryDef = {
  filename: string;
  params?: QueryParamsDef;
};

export type QueryParams = Record<string, SqlValue>;
export type QueryParamsDef = Record<string, (prevParams: QueryParams) => SqlValue>;

export class Query {
  constructor(
    readonly id: number,
    readonly directory: string,
    readonly filename: string,
    readonly resultsFilename?: string,
    readonly params?: QueryParamsDef,
  ) {}

  async run(
    db: Database<unknown>,
    /** In seconds. */
    totalTimeout: number,
    runs: number,
  ): Promise<void> {
    await this.prepare();

    const now = Date.now();

    console.log(`Running query: ${this.filename} at: ${now}`);

    for (let i = 0; i < runs; i++) {
      if (Date.now() - now >= totalTimeout * 1000)
        break;

      await this.runOnce(db, i);
    }
  }

  protected content?: string;
  protected expectedResult?: SqlObject[];

  protected async prepare(): Promise<void> {
    this.content = await fs.readFile(resolve(this.directory, this.filename), 'utf-8');

    if (this.resultsFilename) {
      const resultsPath = resolve(this.directory, this.resultsFilename);
      const resultsContent = await fs.readFile(resultsPath, 'utf-8');
      this.expectedResult = JSON.parse(resultsContent) as SqlObject[];
    }
  }

  protected generateParams(): QueryParams | undefined {
    if (!this.params)
      return undefined;

    const output: QueryParams = {};
    for (const [ key, value ] of Object.entries(this.params))
      output[key] = value(output);

    return output;
  }

  private async runOnce<TResult = unknown>(db: Database<TResult>, iteration: number) {
    gc();

    const info = {
      id: this.id,
      iteration,
    };

    const params = this.generateParams();

    workerLog('Running query iteration', { ...info, params });

    const measureMemory = iteration === 0;
    if (measureMemory)
      workerLog('Memory usage before running query', { ...process.memoryUsage(), ...info });

    await promiseTimeout(1000);

    performance.mark(`runQuery_${this.id}_start`);

    const result = await db.query(this.content, params);

    performance.mark(`runQuery_${this.id}_end`);
    performance.measure(`runQuery_${this.id}`, {
      detail: { ...info, params },
      start: `runQuery_${this.id}_start`,
      end: `runQuery_${this.id}_end`,
    });

    if (measureMemory)
      workerLog('Memory usage after running query', { ...process.memoryUsage(), ...info });

    if (this.expectedResult) {
      const rows = db.exctractResults(result);
      checkQueryResult(info, rows, this.expectedResult);
    }
  }
}

type QueryInfo = {
  id: number;
  iteration: number;
}

function checkQueryResult(query: QueryInfo, actual: SqlObject[], expected: SqlObject[]) {
  if (deepEqual(actual, expected)) {
    workerLog('Query result matches expected result', query);
  } else {
    workerLog('Query result does NOT match expected result', { ...query, expected, actual });
    console.log(
      diff(expected, actual, {
        aAnnotation: 'expected',
        bAnnotation: 'actual',
      }),
    );
  }
}
