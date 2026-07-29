import { performance } from 'node:perf_hooks';
import { QueryParams } from './query.js';
import { Events, workerLog } from './utils/logger.js';

export abstract class Database<TResult> {
  /**
   * Use this to properly setup everything before running the benchmark and to measure the time it takes to setup the environment.
   * Make sure to await it!
   */
  async setup<TOutput = void>(callback?: () => Promise<TOutput>): Promise<TOutput> {
    const start = performance.now();
    const result = await callback?.();
    const duration = performance.now() - start;

    workerLog(Events.environmentSetup, 'Finished preparing environment', { duration });

    return result;
  }

  /**
   * Executes the query and returns it immediate output.
   * Does NOT transform the output (so that we can get accurate measurements).
   */
  abstract query(content: string, params?: QueryParams): Promise<TResult>;

  /**
   * Transforms the raw query output into a common format so that it can be compared with other databases.
   * It's not measured so it doesn't have optimal.
   */
  abstract extractResults(result: TResult): SqlObject[];
}

export type SqlRow = SqlValue[];
export type SqlObject = Record<string, SqlValue>;
// The typed array is here because of SQlite. It's not expected to exist in real life.
export type SqlValue = number | string | null | Uint8Array;

export function rowsToObjects(columns: string[], rows: SqlRow[]): SqlObject[] {
  const objects: SqlObject[] = [];

  for (const row of rows) {
    const object: SqlObject = {};

    for (let i = 0; i < columns.length; i++)
      object[columns[i]] = row[i];

    objects.push(object);
  }

  return objects;
}
