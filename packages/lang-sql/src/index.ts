/**
 * Primary entry point for `@dortdb/lang-sql`. Exports the {@link SQL} language
 * plugin, its AST visitor, the SQL data adapter, and built-in SQL functions.
 *
 * @module default export
 */
export { SQL } from './language/language.js';

export * from './ast/visitor.js';
export * from './language/data-adapter.js';
export * from './functions/coalesce.js';
export * from './functions/string.js';
