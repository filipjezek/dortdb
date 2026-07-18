import { XQueryAggregate } from '../language/language.js';
import {
  sum as coreSum,
  min as coreMin,
  max as coreMax,
} from '@dortdb/core/aggregates';

/** The sum aggregate function in XQuery converts its arguments to numbers by default */
export const sum: XQueryAggregate = {
  ...coreSum,
  step: (state: number, val: number) => {
    let n = +val;
    if (isNaN(n)) n = val;
    if (state === null) return n;
    return state + n;
  },
  result: (state: number) => state ?? 0,
};

/** The min aggregate function in XQuery converts its arguments to numbers by default */
export const min: XQueryAggregate = {
  ...coreMin,
  step: (state: any, val: any) => {
    let n = +val;
    if (isNaN(n)) n = val;
    if (state === null) return n;
    if (n < state) return n;
    return state;
  },
};

/** The max aggregate function in XQuery converts its arguments to numbers by default */
export const max: XQueryAggregate = {
  ...coreMax,
  step: (state: any, val: any) => {
    let n = +val;
    if (isNaN(n)) n = val;
    if (state === null) return n;
    if (n > state) return n;
    return state;
  },
};
