/**
 * Primary entry point for `@dortdb/lang-xquery`. Exports the {@link XQuery}
 * language plugin, its AST visitor, the DOM/XML data adapter, the
 * XQuery-specific plan operators, and shared XQuery context utilities.
 *
 * @module default export
 */
export * from './language/language.js';

export * from './ast/visitor.js';
export * from './utils/dot.js';
export * from './utils/general-comparison.js';
export * from './utils/string.js';
export * from './plan/index.js';
export * from './language/data-adapter.js';
export * from './operators/index.js';
export * from './functions/index.js';
export * from './castables/index.js';
export * from './visitors/attr-rename-checker.js';
export * from './visitors/attr-renamer.js';
export * from './visitors/builder.js';
export * from './visitors/calculation-builder.js';
export * from './visitors/equality-checker.js';
export * from './visitors/executor.js';
export * from './visitors/transitive-deps.js';
export * from './visitors/variable-mapper.js';
