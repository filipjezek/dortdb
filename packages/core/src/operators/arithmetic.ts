import { Operator } from '../extension.js';

export const add: Operator = {
  name: '+',
  impl: (a, b) => (b === undefined ? +a : a + b),
};
export const subtract: Operator = {
  name: '-',
  impl: (a, b) => (b === undefined ? -a : a - b),
};
export const multiply: Operator = {
  name: '*',
  impl: (a, b) => a * b,
};
export const divide: Operator = {
  name: '/',
  impl: (a, b) => a / b,
};
export const idivide: Operator = {
  name: '//',
  impl: (a, b) => Math.floor(a / b),
};
export const mod: Operator = {
  name: '%',
  impl: (a, b) => a % b,
};
export const pow: Operator = {
  name: '^',
  impl: (a, b) => Math.pow(a, b),
};
