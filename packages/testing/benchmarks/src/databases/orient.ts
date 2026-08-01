import { Database, type SqlObject } from '../database.js';
import { QueryParams } from '../query.js';
import orientjs from 'orientjs';
import { parseConnectionString } from '../utils/common.js';

export type OrientDB = orientjs.Db;

type Result = ReturnType<OrientDB['query']>;

export class OrientDatabase extends Database<Result> {
  constructor(
    readonly innerDb: OrientDB
  ) {
    super();
  }

  override async query(content: string, params?: QueryParams) {
    const result = this.innerDb.query(content, { params });
    await result.all();

    return result;
  }

  override extractResults(result: Result): SqlObject[] {
    // FIXME
    return [];
  }

  static create(dataUrl: string): OrientDatabase {
    const { username, password, host, port, database } = parseConnectionString(dataUrl, 'orientdb');

    const dbserver = orientjs({
      host,
      port,
    });
    const innerDb = dbserver.use({
      name: database,
      username,
      password,
    });

    return new OrientDatabase(innerDb);
  }
}
