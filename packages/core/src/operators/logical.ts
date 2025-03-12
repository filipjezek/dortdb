import { Operator } from '../extension.js';

export const or: Operator = {
  name: 'OR',
  impl: (a, b) => a || b,
};
export const and: Operator = {
  name: 'AND',
  impl: (a, b) => a && b,
};
