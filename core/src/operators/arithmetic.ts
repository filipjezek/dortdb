import { Operator } from '../extension.js';

export const add: Operator = {
  name: '+',
  impl: (a: any, b?: any) => (b === undefined ? +a : a + b),
};
export const subtract: Operator = {
  name: '-',
  impl: (a: any, b?: any) => (b === undefined ? -a : a - b),
};
export const multiply: Operator = {
  name: '*',
  impl: (a: any, b: any) => a * b,
};
export const divide: Operator = {
  name: '/',
  impl: (a: any, b: any) => a / b,
};
export const mod: Operator = {
  name: '%',
  impl: (a: any, b: any) => a % b,
};
export const pow: Operator = {
  name: '^',
  impl: (a: any, b: any) => Math.pow(a, b),
};
