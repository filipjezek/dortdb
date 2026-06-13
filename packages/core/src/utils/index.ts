/**
 * Assorted utility helpers used throughout the engine - assertions,
 * plan-operator construction helpers (projection, selection, calculation),
 * schema/parent linking, aggregate extraction, null-shortcutting, object
 * serialization, and small invocation helpers.
 *
 * @packageDocumentation
 */

export * from './assert-literal.js';
export * from './override-source.js';
export * from './trie.js';
export * from './invoke.js';
export * from './arr-set-parent.js';
export * from './projection.js';
export * from './selection.js';
export * from './calculation.js';
export * from './serialize-to-objects.js';
export * from './link-schema-to-parent.js';
export * from './get-aggregates.js';
export * from './shortcut-nulls.js';
