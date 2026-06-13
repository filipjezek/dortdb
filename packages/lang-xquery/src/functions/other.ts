import { Fn } from '@dortdb/core';

/** XQuery `fn:exists()` — returns `true` if the argument sequence is non-empty. */
export const exists: Fn = {
  name: 'exists',
  impl: (items) =>
    Array.isArray(items)
      ? items.length > 0
      : items !== null && items !== undefined,
};

/** XQuery `fn:empty()` — returns `true` if the argument sequence is empty. */
export const empty: Fn = {
  name: 'empty',
  impl: (items) =>
    Array.isArray(items)
      ? items.length === 0
      : items === null || items === undefined,
};

/**
 * XQuery `fn:data()` — returns the atomized value of its argument; in this
 * implementation atomization is handled by the executor, so the function
 * passes its first argument through unchanged.
 */
export const data: Fn = {
  name: 'data',
  schema: 'fn',
  impl: (...vals) => vals[0],
};
