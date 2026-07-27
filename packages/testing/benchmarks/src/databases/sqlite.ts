import { Database, rowsToObjects, type SqlObject } from '../database.js';
import { QueryParams } from '../query.js';
import initSqlJs, { QueryExecResult, type Database as SqliteDB } from 'sql.js';

export { SqliteDB };

export class SqliteDatabase extends Database<QueryExecResult[]> {
  constructor(
    readonly innerDb: SqliteDB
  ) {
    super();
  }

  override async query(content: string, params?: QueryParams) {
    return this.innerDb.exec(content, params);
  }

  override exctractResults(result: QueryExecResult[]): SqlObject[] {
    // A list of results is returned (one for each statement executed). However, for some un-fucking-believable reason, if there are no rows, the result is skipped.
    // Unbelievable.
    if (result.length === 0)
      return [];

    const { columns, values } = result[0];
    return rowsToObjects(columns, values);
  }

  private static SqlPromise: Promise<initSqlJs.SqlJsStatic> | undefined;

  static async create(): Promise<SqliteDatabase> {
    SqliteDatabase.SqlPromise ??= initSqlJs();
    const SQL = await SqliteDatabase.SqlPromise;

    return new SqliteDatabase(new SQL.Database());
  }
}
