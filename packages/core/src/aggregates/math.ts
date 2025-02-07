import { AggregateFn } from '../extension.js';

export const count: AggregateFn = {
  name: 'count',
  init: () => 0,
  step: (state: number) => state + 1,
  stepInverse: (state: number) => state - 1,
  result: (state: number) => state,
};

export const sum: AggregateFn = {
  name: 'sum',
  init: () => 0,
  step: (state: number, val: number) => state + val,
  stepInverse: (state: number, val: number) => state - val,
  result: (state: number) => state,
};

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
  result: (state: { sum: number; count: number }) => state.sum / state.count,
};

export const min: AggregateFn = {
  name: 'min',
  init: () => Infinity,
  step: (state: number, val: number) => Math.min(state, val),
  result: (state: number) => state,
};

export const max: AggregateFn = {
  name: 'max',
  init: () => -Infinity,
  step: (state: number, val: number) => Math.max(state, val),
  result: (state: number) => state,
};
