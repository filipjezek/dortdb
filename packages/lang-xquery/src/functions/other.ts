import { Fn } from '@dortdb/core';

export const exists: Fn = {
  name: 'exists',
  impl: (items) =>
    Array.isArray(items)
      ? items.length > 0
      : items !== null && items !== undefined,
};

export const data: Fn = {
  name: 'data',
  schema: 'fn',
  impl: (...vals) => vals[0],
};
