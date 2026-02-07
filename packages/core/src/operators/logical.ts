import { Operator } from '../extension.js';
import { shortcutNulls } from '../utils/index.js';

export const or: Operator = {
  name: 'or',
  impl: (a, b) => a || b,
};
export const and: Operator = {
  name: 'and',
  impl: (a, b) => a && b,
};
export const not: Operator = {
  name: 'not',
  impl: shortcutNulls((a) => !a),
};
