import { Operator } from '@dortdb/core';

export const add: Operator = {
  name: '+',
  impl: (a: any, b: any) => {
    if (Array.isArray(a) && Array.isArray(b)) {
      return [...a, ...b];
    }
    return a + b;
  },
};
