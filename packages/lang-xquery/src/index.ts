/**
 * Primary entry point for `@dortdb/lang-xquery`. Exports the {@link XQuery}
 * language plugin, its AST visitor, the DOM/XML data adapter, the
 * XQuery-specific plan operators, and shared XQuery context utilities.
 *
 * @module default export
 */
export { XQuery } from './language/language.js';

export * from './ast/visitor.js';
export * from './utils/dot.js';
export * from './plan/index.js';
export * from './language/data-adapter.js';
