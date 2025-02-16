import { Fn } from 'src/extension.js';

export const unwind: Fn = {
  name: 'unwind',
  impl: (val: any) => (Array.isArray(val) ? val : val === null ? [] : [val]),
};
