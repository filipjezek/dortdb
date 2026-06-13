/**
 * Primary entry point for `@dortdb/core`. Bundles the engine's foundational
 * building blocks: the {@link DortDB} database class, the language-plugin and
 * extension interfaces, the shared AST node types, the logical-plan visitor
 * framework, query indices, the execution context, and the engine error types.
 *
 * @module default export
 */
export * from './ast.js';
export * from './lang-manager.js';
export * from './extension.js';
export * from './db.js';
export * from './plan/visitor.js';
export * from './visitors/index.js';
export * from './errors.js';
export * from './indices/index.js';
export * from './execution-context.js';
