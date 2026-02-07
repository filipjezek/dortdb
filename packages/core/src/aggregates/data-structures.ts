import { AggregateFn } from '../extension.js';

export const collect: AggregateFn = {
  name: 'collect',
  init: () => [],
  step: (state, val) => {
    state.push(val);
    return state;
  },
  stepInverse: (state, _) => {
    (state as unknown[]).shift();
    return state;
  },
  result: (state) => state,
  includeNulls: true,
};
