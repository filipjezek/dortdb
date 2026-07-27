import { Database, type SqlObject } from '../database.js';
import { QueryParams } from '../query.js';
import orientjs from 'orientjs';

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

  override exctractResults(result: Result): SqlObject[] {
    // FIXME
    return [];
  }

  static create(): OrientDatabase {
    const dbserver = orientjs({
      host: 'localhost',
      port: 2424,
    });
    const innerDb = dbserver.use({
      name: 'test',
      username: 'root',
      password: 'pass',
    });

    return new OrientDatabase(innerDb);
  }
}
