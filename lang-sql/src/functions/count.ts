import { AggregateFn } from '@dortdb/core';

export const count: AggregateFn = {
  name: 'count',
  init: () => 0,
  step: (state, value) => state + 1,
  stepInverse: (state, value) => state - 1,
  result: (state) => state,
};
