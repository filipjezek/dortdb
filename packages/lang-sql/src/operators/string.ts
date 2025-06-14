import { Operator } from '@dortdb/core';

export const concat: Operator = {
  name: '||',
  impl: (a, b) => {
    if (Array.isArray(a)) return a.concat(b);
    if (Array.isArray(b)) return b.concat(a);
    return a + b;
  },
};
