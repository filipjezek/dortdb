import { Operator } from '../extension.js';

export const or: Operator = {
  name: 'or',
  impl: (a, b) => a || b,
};
export const and: Operator = {
  name: 'and',
  impl: (a, b) => a && b,
};
