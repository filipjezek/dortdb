import { Operator } from '../extension.js';

export const eq: Operator = {
  name: '=',
  impl: (a, b) => a === b,
};

export const neq: Operator = {
  name: '!=',
  impl: (a, b) => a !== b,
};

export const neq2: Operator = {
  name: '<>',
  impl: neq.impl,
};

export const gt: Operator = {
  name: '>',
  impl: (a, b) => a > b,
};

export const lt: Operator = {
  name: '<',
  impl: (a, b) => a < b,
};

export const ge: Operator = {
  name: '>=',
  impl: (a, b) => a >= b,
};

export const le: Operator = {
  name: '<=',
  impl: (a, b) => a <= b,
};
