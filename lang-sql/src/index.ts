import { DortDB } from '@dortdb/core';
import { SQL } from './parser/language.js';

const db = new DortDB({
  mainLang: SQL,
});
console.log(db.parse('SELECT * FROM foo WHERE a = b + 3 * 2'));

export { SQL };
