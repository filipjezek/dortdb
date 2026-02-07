import { Operator } from '../extension.js';
import { shortcutNulls } from '../utils/shortcut-nulls.js';

export const add: Operator = {
  name: '+',
  impl: shortcutNulls((a, b) => (b === undefined ? +a : a + b)),
};
export const subtract: Operator = {
  name: '-',
  impl: shortcutNulls((a, b) => (b === undefined ? -a : a - b)),
};
export const multiply: Operator = {
  name: '*',
  impl: shortcutNulls((a, b) => a * b),
};
export const divide: Operator = {
  name: '/',
  impl: shortcutNulls((a, b) => a / b),
};
export const idivide: Operator = {
  name: '//',
  impl: shortcutNulls((a, b) => Math.floor(a / b)),
};
export const mod: Operator = {
  name: '%',
  impl: shortcutNulls((a, b) => a % b),
};
export const pow: Operator = {
  name: '^',
  impl: shortcutNulls((a, b) => Math.pow(a, b)),
};
