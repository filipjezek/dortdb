import { DortDB } from '@dortdb/core';
import { SQL } from './parser/language.js';

const db = new DortDB({
  mainLang: SQL,
});
console.log(db.parse("SELECT bar('foo', 13 * a.b)"));

export { SQL };
export * from './ast/index.js';
export * from './ast/visitor.js';
