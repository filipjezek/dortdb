import { QueryParams } from './query.js';

export abstract class Database<TResult> {
  abstract query(content: string, params?: QueryParams): Promise<TResult>;

  abstract exctractResults(result: TResult): SqlObject[];
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
