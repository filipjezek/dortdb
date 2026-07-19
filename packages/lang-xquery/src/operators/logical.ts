import { Operator } from '@dortdb/core';
import { toBool } from '../castables/basic-types.js';

/** XQuery `and` operator. Coverts to boolean according to the XQuery specification. */
export const and: Operator = {
  name: 'and',
  impl: (a, b) => toBool.convert(a) && toBool.convert(b),
};

/** XQuery `or` operator. Coverts to boolean according to the XQuery specification. */
export const or: Operator = {
  name: 'or',
  impl: (a, b) => toBool.convert(a) || toBool.convert(b),
};
