import { Operator } from '@dortdb/core';
import { shortcutNulls } from '@dortdb/core/utils';

export const inOp: Operator = {
  name: 'in',
  impl: shortcutNulls((a: unknown, b: unknown): boolean => {
    if (!b || typeof b !== 'object' || !(Symbol.iterator in b)) return false;
    let nullFound = false;
    for (const item of b as Iterable<unknown>) {
      if (a === item) return true;
      if (item === null || item === undefined) nullFound = true;
    }
    return nullFound ? null : false;
  }),
};

export const notInOp: Operator = {
  name: 'not in',
  impl: shortcutNulls((a: unknown, b: unknown): boolean => {
    if (!b || typeof b !== 'object' || !(Symbol.iterator in b)) return true;
    let nullFound = false;
    for (const item of b as Iterable<unknown>) {
      if (a === item) return false;
      if (item === null || item === undefined) nullFound = true;
    }
    return nullFound ? null : true;
  }),
};

export const between: Operator = {
  name: 'between',
  impl: shortcutNulls((a: unknown, b: unknown, c: unknown): boolean => {
    return a >= b && a <= c;
  }),
};
