import { AggregateFn } from '../extension.js';

/**
 * Collects the values received into an array, in arrival order.
 *
 * @remarks Unlike the numeric aggregates this keeps `null`s (see
 * {@link AggregateFn.includeNulls}). Its inverse step evicts from the front, so
 * in a sliding window it yields the values currently in the frame.
 */
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
