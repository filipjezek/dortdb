import { Operator } from '@dortdb/core';
import { generalComparison } from '../utils/general-comparison.js';
import * as ops from '@dortdb/core/operators';
import { XQueryOp } from '../language/language.js';
import { shortcutNulls } from '@dortdb/core/utils';

/** XQuery general comparison `=` — true if any pair of items from the two sequences are equal. */
export const eq: Operator = {
  name: '=',
  impl: (a, b) => generalComparison(ops.eq.impl, a, b),
};
/** XQuery general comparison `!=` — true if any pair of items from the two sequences are not equal. */
export const neq: Operator = {
  name: '!=',
  impl: (a, b) => generalComparison(ops.neq.impl, a, b),
};
/** XQuery general comparison `>=` — true if any item in `a` is greater than or equal to any item in `b`. */
export const ge: Operator = {
  name: '>=',
  impl: (a, b) => generalComparison(ops.ge.impl, a, b),
};
/** XQuery general comparison `<=` — true if any item in `a` is less than or equal to any item in `b`. */
export const le: Operator = {
  name: '<=',
  impl: (a, b) => generalComparison(ops.le.impl, a, b),
};
/** XQuery general comparison `>` — true if any item in `a` is greater than any item in `b`. */
export const gt: Operator = {
  name: '>',
  impl: (a, b) => generalComparison(ops.gt.impl, a, b),
};
/** XQuery general comparison `<` — true if any item in `a` is less than any item in `b`. */
export const lt: Operator = {
  name: '<',
  impl: (a, b) => generalComparison(ops.lt.impl, a, b),
};

/** XQuery value comparison `eq` — compares two atomic values for equality. */
export const kwEq: Operator = {
  name: 'eq',
  impl: ops.eq.impl,
};
/** XQuery value comparison `ne` — compares two atomic values for inequality. */
export const kwNeq: Operator = {
  name: 'ne',
  impl: ops.neq.impl,
};
/** XQuery value comparison `ge` — true if the first atomic value is greater than or equal to the second. */
export const kwGe: Operator = {
  name: 'ge',
  impl: ops.ge.impl,
};
/** XQuery value comparison `le` — true if the first atomic value is less than or equal to the second. */
export const kwLe: Operator = {
  name: 'le',
  impl: ops.le.impl,
};
/** XQuery value comparison `gt` — true if the first atomic value is greater than the second. */
export const kwGt: Operator = {
  name: 'gt',
  impl: ops.gt.impl,
};
/** XQuery value comparison `lt` — true if the first atomic value is less than the second. */
export const kwLt: Operator = {
  name: 'lt',
  impl: ops.lt.impl,
};

/** XQuery node identity operator `is` — true if both operands refer to the same node. */
export const is: XQueryOp = {
  name: 'is',
  skipAtomization: true,
  impl: (a, b) => a === b,
};
/** XQuery document-order operator `<<` — true if `a` precedes `b` in document order. */
export const docLe: XQueryOp = {
  name: '<<',
  skipAtomization: true,
  impl: shortcutNulls((a, b) => {
    if (!(a instanceof Node && b instanceof Node)) {
      return false;
    }
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING;
  }),
};
/** XQuery document-order operator `>>` — true if `a` follows `b` in document order. */
export const docGe: XQueryOp = {
  name: '>>',
  skipAtomization: true,
  impl: shortcutNulls((a, b) => {
    if (!(a instanceof Node && b instanceof Node)) {
      return false;
    }
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
  }),
};
