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
        // So, if you plan to develop a database driver and you feel the need to define a "default value", maybe, just maybe, you should make sure the default value is actually used if undefined (or even no property at all) is passed. Is that really too much to ask? Unbeliavable.
        password: password ?? '',
      },
    });

    return new ArangoDatabase(innerDb);
  }
}
