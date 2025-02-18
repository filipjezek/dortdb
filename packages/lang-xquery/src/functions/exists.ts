import { Fn } from '@dortdb/core';

export const exists: Fn = {
  name: 'exists',
  impl: (items: any) =>
    Array.isArray(items)
      ? items.length > 0
      : items !== null && items !== undefined,
};
