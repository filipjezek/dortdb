import { Fn } from '@dortdb/core';

/** Returns the first non-`null`/`undefined` argument, or `null` if all arguments are absent. */
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
