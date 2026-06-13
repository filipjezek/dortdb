/**
 * The logical-plan optimizer and its rule set. Exports the optimizer driver,
 * the optimization-rule interface, and the built-in rules - selection
 * pushdown, subquery unnesting, projection merging, products-to-joins, join
 * and index scans, and more.
 *
 * @packageDocumentation
 */

export * from './optimizer.js';
export * from './rule.js';
export * from './rules/default-rules.js';
export * from './rules/to-from-items.js';
export * from './rules/selection-pushdown.js';
export * from './rules/remove-projection-concat.js';
export * from './rules/unnest-subqueries.js';
export * from './rules/merge-projections.js';
export * from './rules/products-to-joins.js';
export * from './rules/join-indices.js';
export * from './rules/index-scans.js';
