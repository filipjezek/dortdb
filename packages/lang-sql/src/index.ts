import { DortDB } from '@dortdb/core';
import { SQL } from './parser/language.js';

const db = new DortDB({
  mainLang: SQL,
});
const res = db.parse(
  "SELECT bar('foo', 13 * a.b), o FROM test WHERE a > 3; ) foo bar baz"
);
console.log(res);

export { SQL };
export * from './ast/index.js';
export * from './ast/visitor.js';
