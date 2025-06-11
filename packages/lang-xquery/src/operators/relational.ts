import { Operator } from '@dortdb/core';
import { generalComparison } from '../utils/general-comparison.js';
import * as ops from '@dortdb/core/operators';
import { XQueryOp } from '../language/language.js';

export const eq: Operator = {
  name: '=',
  impl: (a, b) => generalComparison(ops.eq.impl, a, b),
};
export const neq: Operator = {
  name: '!=',
  impl: (a, b) => generalComparison(ops.neq.impl, a, b),
};
export const ge: Operator = {
  name: '>=',
  impl: (a, b) => generalComparison(ops.ge.impl, a, b),
};
export const le: Operator = {
  name: '<=',
  impl: (a, b) => generalComparison(ops.le.impl, a, b),
};
export const gt: Operator = {
  name: '>',
  impl: (a, b) => generalComparison(ops.gt.impl, a, b),
};
export const lt: Operator = {
  name: '<',
  impl: (a, b) => generalComparison(ops.lt.impl, a, b),
};

export const kwEq: Operator = {
  name: 'eq',
  impl: ops.eq.impl,
};
export const kwNeq: Operator = {
  name: 'ne',
  impl: ops.neq.impl,
};
export const kwGe: Operator = {
  name: 'ge',
  impl: ops.ge.impl,
};
export const kwLe: Operator = {
  name: 'le',
  impl: ops.le.impl,
};
export const kwGt: Operator = {
  name: 'gt',
  impl: ops.gt.impl,
};
export const kwLt: Operator = {
  name: 'lt',
  impl: ops.lt.impl,
};

export const is: XQueryOp = {
  name: 'is',
  skipAtomization: true,
  impl: (a, b) => a === b,
};
export const docLe: XQueryOp = {
  name: '<<',
  skipAtomization: true,
  impl: (a, b) => {
    if (!(a instanceof Node && b instanceof Node)) {
      return false;
    }
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING;
  },
};
export const docGe: XQueryOp = {
  name: '>>',
  skipAtomization: true,
  impl: (a, b) => {
    if (!(a instanceof Node && b instanceof Node)) {
      return false;
    }
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
  },
};
