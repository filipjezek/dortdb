import { Operator } from '../extension.js';
import { shortcutNulls } from '../utils/index.js';

/** Logical OR (`||`). Three-valued logic. */
export const or: Operator = {
  name: 'or',
  impl: (a, b) => a || b || (a === null ? a : b),
};
/** Logical AND (`&&`). Three-valued logic. */
export const and: Operator = {
  name: 'and',
  impl: (a, b) => (a && b) || (b === false ? b : a),
};
/** Logical NOT (`!`); propagates `null`. */
export const not: Operator = {
  name: 'not',
  impl: shortcutNulls((a) => !a),
};
/** Falsy negation (`!a`) without null propagation; treats `null` as falsy. */
export const neg: Operator = {
  name: 'neg',
  impl: (a) => !a,
};
