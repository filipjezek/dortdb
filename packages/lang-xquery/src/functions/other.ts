import { Fn } from '@dortdb/core';
import { FnContext } from './fn-context.js';

export const exists: Fn = {
  name: 'exists',
  impl: (items) =>
    Array.isArray(items)
      ? items.length > 0
      : items !== null && items !== undefined,
};

function getArg(args: any[]) {
  if (args.length === 1) {
    return (args[0] as FnContext).item;
  }
  return args[0];
}

export const data: Fn = {
  name: 'data',
  schema: 'fn',
  impl: (...vals) => getArg(vals),
};
