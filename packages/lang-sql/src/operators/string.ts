import { Operator } from '@dortdb/core';
import { likeToRegex } from '../utils/string.js';

export const concat: Operator = {
  name: '||',
  impl: (a, b) => {
    if (Array.isArray(a)) return a.concat(b);
    if (Array.isArray(b)) return b.concat(a);
    return a + b;
  },
};

export const like: Operator = {
  name: 'like',
  impl: (a, b) => {
    a = a?.toString() ?? '';
    const regex =
      b instanceof RegExp ? b : likeToRegex(b?.toString() ?? '', true);
    return regex.test(a);
  },
};
export const ilike: Operator = {
  name: 'ilike',
  impl: (a, b) => {
    a = a?.toString() ?? '';
    const regex =
      b instanceof RegExp ? b : likeToRegex(b?.toString() ?? '', false);
    return regex.test(a);
  },
};
