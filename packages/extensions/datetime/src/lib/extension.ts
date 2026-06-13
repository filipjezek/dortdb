import { Extension } from '@dortdb/core';
import { dateAdd, dateSub, extract, interval, now } from './functions.js';

/**
 * An extension registering date/time functions (`now`, `interval`, date `add`/`sub`,
 * `extract`) for use from any query language.
 *
 * @example
 * ```ts
 * import { DortDB } from '@dortdb/core';
 * import { SQL } from '@dortdb/lang-sql';
 * import { datetime } from '@dortdb/datetime';
 *
 * const db = new DortDB({ mainLang: SQL(), extensions: [datetime] });
 * db.query("SELECT extract(now(), 'year')");
 * ```
 */
export const datetime: Extension = {
  functions: [now, interval, dateAdd, dateSub, extract],
};
