import { Database, type SqlObject } from '../database.js';
import { QueryParams } from '../query.js';
import { Database as ArangoDB } from 'arangojs';
import { Cursor } from 'arangojs/cursors';
import { parseConnectionString } from '../utils/common.js';

export class ArangoDatabase extends Database<Cursor> {
  constructor(
    readonly innerDb: ArangoDB
  ) {
    super();
  }

  override async query(content: string, params?: QueryParams) {
    const result = await this.innerDb.query(content, params, { cache: false });
    await result.all();

    return result;
  }

  override extractResults(result: Cursor): SqlObject[] {
    // FIXME
    return [];
  }

  static create(dataUrl: string): ArangoDatabase {
    const { username, password, host, port, database } = parseConnectionString(dataUrl, 'arangodb');

    const innerDb = new ArangoDB({
      url: `http://${host}:${port}`,
      databaseName: database,
      auth: {
        username,
        password,
      },
    });

    return new ArangoDatabase(innerDb);
  }
}
