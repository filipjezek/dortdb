import { resolve } from 'node:path';
import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import type { Database, SqlObject, SqlValue } from './database.js';
import { deepEqual, promiseTimeout } from './utils/common.js';
import { diff } from '@vitest/utils/diff';
import { Events, workerLog } from './utils/logger.js';

export class QueryRegistry {
  constructor(
    readonly directory: string,
    readonly definitions: QueryDef[],
  ) {}

  async run(
    db: Database<unknown>,
    queryIds: number[],
    runs: number[],
    /** In seconds. */
    totalTimeout: number,
  ): Promise<void> {
    const runsArray = runs.length === 1 ? Array.from({ length: queryIds.length }, () => runs[0]) : runs;
    if (queryIds.length !== runsArray.length)
      throw new Error(`Length of queryIds (${queryIds.length}) does not match length of runs (${runsArray.length})`);

    for (let i = 0; i < queryIds.length; i++) {
      const queryId = queryIds[i];
      const runsForQuery = runsArray[i];

      if (queryId < 1 || queryId > this.definitions.length)
        throw new Error(`Invalid query ID: ${queryId}. Must be between 1 and ${this.definitions.length}`);

      const def = this.definitions[queryId - 1];
      const query = new Query(
        queryId,
        this.directory,
        def.filename,
        def.resultsFilename,
        def.params,
      );

      try {
        await query.run(db, totalTimeout, runsForQuery);
      }
      catch (error) {
        workerLog(Events.queryError, `Error running query ${queryId}`, {
          queryId,
          filename: def.filename,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

export type QueryDef = {
  filename: string;
  resultsFilename?: string;
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
      if (Date.now() - now >= totalTimeout * 1000) {
        workerLog(Events.softTimeout, `Worker timed out after ${totalTimeout}s`, { queryId: this.id, iteration: i });
        break;
      }

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

    const queryId = this.id;
    const params = this.generateParams();

    workerLog(Events.runQuery, `Running query ${queryId} iteration ${iteration}`, { queryId, iteration, params });

    const measureMemory = iteration === 0;
    if (measureMemory)
      workerLog(Events.memoryBeforeQuery, 'Memory usage before running query', { queryId, iteration, ...process.memoryUsage() });

    await promiseTimeout(1000);

    const start = performance.now();
    const result = await db.query(this.content, params);
    const duration = performance.now() - start;

    workerLog(Events.queryExecuted, 'Query executed', { queryId, iteration, duration });

    if (measureMemory)
      workerLog(Events.memoryAfterQuery, 'Memory usage after running query', { queryId, iteration, ...process.memoryUsage() });

    if (this.expectedResult) {
      const rows = db.extractResults(result);
      checkQueryResult(queryId, iteration, rows, this.expectedResult);
    }
  }
}

function checkQueryResult(queryId: number, iteration: number, actual: SqlObject[], expected: SqlObject[]) {
  if (deepEqual(actual, expected)) {
    workerLog(Events.queryResultRight, 'Query result matches expected result', { queryId, iteration });
  } else {
    workerLog(Events.queryResultWrong, 'Query result does NOT match expected result', { queryId, iteration, expected, actual });
    console.log(
      diff(expected, actual, {
        aAnnotation: 'expected',
        bAnnotation: 'actual',
      }),
    );
  }
}
