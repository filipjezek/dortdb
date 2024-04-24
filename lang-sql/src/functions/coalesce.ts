import { Fn } from '@dortdb/core';

export const coalesce: Fn = {
  name: 'coalesce',
  impl: (...args: any[]) => {
    for (const arg of args) {
      if (arg !== null && arg !== undefined) {
        return arg;
      }
    }
    return null;
  },
};
