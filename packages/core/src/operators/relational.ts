import { Operator } from '../extension.js';
import { shortcutNulls } from '../utils/shortcut-nulls.js';

export const eq: Operator = {
  name: '=',
  impl: shortcutNulls((a, b) => a == b),
};

export const neq: Operator = {
  name: '!=',
  impl: shortcutNulls((a, b) => a != b),
};

export const neq2: Operator = {
  name: '<>',
  impl: neq.impl,
};

export const gt: Operator = {
  name: '>',
  impl: shortcutNulls((a, b) => a > b),
};

export const lt: Operator = {
  name: '<',
  impl: shortcutNulls((a, b) => a < b),
};

export const ge: Operator = {
  name: '>=',
  impl: shortcutNulls((a, b) => a >= b),
};

export const le: Operator = {
  name: '<=',
  impl: shortcutNulls((a, b) => a <= b),
};

export const isOp: Operator = {
  name: 'is',
  impl: (a: unknown, b: unknown): boolean => {
    return a === b;
  },
};
