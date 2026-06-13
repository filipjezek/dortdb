import { Operator } from '../extension.js';
import { shortcutNulls } from '../utils/index.js';

/** Short-circuit logical OR (`||`); does not propagate `null`. */
export const or: Operator = {
  name: 'or',
  impl: (a, b) => a || b,
};
/** Short-circuit logical AND (`&&`); does not propagate `null`. */
export const and: Operator = {
  name: 'and',
  impl: (a, b) => a && b,
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
