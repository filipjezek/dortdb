/**
 * Primary entry point for `@dortdb/lang-cypher`. Exports the {@link Cypher}
 * language plugin, its AST visitor, the connection index, and the graph data
 * adapters (including the Graphology-backed adapter).
 *
 * @module default export
 */
export { Cypher } from './language/language.js';
export * from './ast/visitor.js';
export * from './indices/connection-index.js';
export * from './language/data-adapter.js';
export * from './language/graphology-adapter.js';
