import { AggregateFn } from '../extension.js';

/**
 * Counts the values received. Supports windowed evaluation through its inverse
 * step. Like the other aggregates it ignores `null`s, so it counts non-null
 * inputs.
 */
export const count: AggregateFn = {
  name: 'count',
  init: () => 0,
  step: (state: number) => state + 1,
  stepInverse: (state: number) => state - 1,
  result: (state: number) => state,
};

/**
 * Sums the values received, or `null` when no values were aggregated. Supports
 * windowed evaluation through its inverse step.
 */
export const sum: AggregateFn = {
  name: 'sum',
  init: () => null,
  step: (state: number, val: number) => (state === null ? val : state + val),
  stepInverse: (state: number, val: number) => state - val,
  result: (state: number) => state,
};

/**
 * Computes the arithmetic mean of the values received, or `null` when no values
 * were aggregated. Supports windowed evaluation through its inverse step.
 */
export const avg: AggregateFn = {
  name: 'avg',
  init: () => ({ sum: 0, count: 0 }),
  step: (state: { sum: number; count: number }, val: number) => {
    state.sum += val;
    state.count++;
    return state;
  },
  stepInverse: (state: { sum: number; count: number }, val: number) => {
    state.sum -= val;
    state.count--;
    return state;
  },
  result: (state: { sum: number; count: number }) =>
    state.count === 0 ? null : state.sum / state.count,
};

/**
 * Returns the smallest value received (compared with `<`), or `null` when no
 * values were aggregated.
 *
 * @remarks Provides no inverse step, so windowed use recomputes the frame.
 */
export const min: AggregateFn = {
  name: 'min',
  init: () => null,
  step: (state: any, val: any) => {
    if (state === null) return val;
    if (val < state) return val;
    return state;
  },
  result: (state: any) => state,
};

/**
 * Returns the largest value received (compared with `>`), or `null` when no
 * values were aggregated.
 *
 * @remarks Provides no inverse step, so windowed use recomputes the frame.
 */
export const max: AggregateFn = {
  name: 'max',
  init: () => null,
  step: (state: any, val: any) => {
    if (state === null) return val;
    if (val > state) return val;
    return state;
  },
  result: (state: any) => state,
};
