import { Fn } from '@dortdb/core';

export const coalesce: Fn = {
  name: 'coalesce',
  impl: (...args: unknown[]) => {
    for (const arg of args) {
      if (arg !== null && arg !== undefined) {
        return arg;
      }
    }
    return null;
  },
};
