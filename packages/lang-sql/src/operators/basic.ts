import { Operator } from '@dortdb/core';

export const inOp: Operator = {
  name: 'in',
  impl: (a: unknown, b: unknown): boolean => {
    if (!b || typeof b !== 'object' || !(Symbol.iterator in b)) return false;
    for (const item of b as Iterable<unknown>) {
      if (a === item) return true;
    }
    return false;
  },
};

export const notInOp: Operator = {
  name: 'not in',
  impl: (a: unknown, b: unknown): boolean => {
    if (!b || typeof b !== 'object' || !(Symbol.iterator in b)) return true;
    for (const item of b as Iterable<unknown>) {
      if (a === item) return false;
    }
    return true;
  },
};
