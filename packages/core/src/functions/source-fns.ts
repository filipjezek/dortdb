import { Fn } from '../extension.js';

export const unwind: Fn = {
  name: 'unwind',
  impl: (val: unknown) => {
    return Array.isArray(val)
      ? val
      : val === null || val === undefined
        ? []
        : [val];
  },
};
