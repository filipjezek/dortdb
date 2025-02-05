import { AggregateFn } from '../extension.js';

export const collect: AggregateFn = {
  name: 'collect',
  init: () => [],
  step: (acc, val) => {
    acc.push(val);
    return acc;
  },
  stepInverse: (acc, _) => {
    (acc as any[]).shift();
    return acc;
  },
  result: (acc) => acc,
};
