import { AggregateFn } from '@dortdb/core';

export const sum: AggregateFn = {
  name: 'sum',
  init: () => 0,
  step: (state, value) => state + value,
  stepInverse: (state, value) => state - value,
  result: (state) => state,
};
