import { AggregateFn } from '../extension.js';

export const count: AggregateFn = {
  name: 'count',
  init: () => 0,
  step: (acc: number) => acc + 1,
  stepInverse: (acc: number) => acc - 1,
  result: (acc: number) => acc,
};

export const sum: AggregateFn = {
  name: 'sum',
  init: () => 0,
  step: (acc: number, val: number) => acc + val,
  stepInverse: (acc: number, val: number) => acc - val,
  result: (acc: number) => acc,
};

export const avg: AggregateFn = {
  name: 'avg',
  init: () => ({ sum: 0, count: 0 }),
  step: (acc: { sum: number; count: number }, val: number) => {
    acc.sum += val;
    acc.count++;
    return acc;
  },
  stepInverse: (acc: { sum: number; count: number }, val: number) => {
    acc.sum -= val;
    acc.count--;
    return acc;
  },
  result: (acc: { sum: number; count: number }) => acc.sum / acc.count,
};

export const min: AggregateFn = {
  name: 'min',
  init: () => Infinity,
  step: (acc: number, val: number) => Math.min(acc, val),
  result: (acc: number) => acc,
};

export const max: AggregateFn = {
  name: 'max',
  init: () => -Infinity,
  step: (acc: number, val: number) => Math.max(acc, val),
  result: (acc: number) => acc,
};
