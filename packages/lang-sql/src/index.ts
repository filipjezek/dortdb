/**
 * Primary entry point for `@dortdb/lang-sql`. Exports the {@link SQL} language
 * plugin, its AST visitor, the SQL data adapter, and built-in SQL functions.
 *
 * @module default export
 */
export * from './language/language.js';

export * from './ast/visitor.js';
export * from './language/data-adapter.js';
export * from './functions/index.js';
export * from './operators/index.js';
export * from './plan/index.js';
export * from './visitors/builder.js';
export * from './visitors/calculation-builder.js';
export * from './visitors/ast-stringifier.js';
export * from './visitors/equality-checker.js';
export * from './visitors/executor.js';
export * from './visitors/schema-inferrer.js';
export * from './utils/is-table-attr.js';
export * from './utils/string.js';
