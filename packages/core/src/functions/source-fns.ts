import { Fn } from '../extension.js';

export const unwind: Fn = {
  name: 'unwind',
  impl: (val: unknown) =>
    Array.isArray(val) ? val : val === null ? [] : [val],
};
