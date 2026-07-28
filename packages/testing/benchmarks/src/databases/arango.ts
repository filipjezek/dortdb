import { Database, type SqlObject } from '../database.js';
import { QueryParams } from '../query.js';
import { Database as ArangoDB } from 'arangojs';
import { Cursor } from 'arangojs/cursors';

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

  static create(): ArangoDatabase {
    const innerDb = new ArangoDB();

    return new ArangoDatabase(innerDb);
  }
}
