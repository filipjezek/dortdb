import { DortDB } from '@dortdb/core';
import { Cypher } from './language.js';

export { Cypher } from './language.js';
export * from './ast/index.js';
export * from './ast/visitor.js';

const db = new DortDB({
  mainLang: Cypher,
});

db.parse('RETURN [a = (a) | a]');
