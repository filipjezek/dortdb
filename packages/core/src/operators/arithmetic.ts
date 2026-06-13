import { Operator } from '../extension.js';
import { shortcutNulls } from '../utils/shortcut-nulls.js';

/** Addition (binary) or unary plus; propagates `null`. */
export const add: Operator = {
  name: '+',
  impl: shortcutNulls((a, b) => (b === undefined ? +a : a + b)),
};
/** Subtraction (binary) or unary negation; propagates `null`. */
export const subtract: Operator = {
  name: '-',
  impl: shortcutNulls((a, b) => (b === undefined ? -a : a - b)),
};
/** Multiplication; propagates `null`. */
export const multiply: Operator = {
  name: '*',
  impl: shortcutNulls((a, b) => a * b),
};
/** Division; propagates `null`. */
export const divide: Operator = {
  name: '/',
  impl: shortcutNulls((a, b) => a / b),
};
/** Integer division (floor); propagates `null`. */
export const idivide: Operator = {
  name: '//',
  impl: shortcutNulls((a, b) => Math.floor(a / b)),
};
/** Modulo; propagates `null`. */
export const mod: Operator = {
  name: '%',
  impl: shortcutNulls((a, b) => a % b),
};
/** Exponentiation; propagates `null`. */
export const pow: Operator = {
  name: '^',
  impl: shortcutNulls((a, b) => Math.pow(a, b)),
};
