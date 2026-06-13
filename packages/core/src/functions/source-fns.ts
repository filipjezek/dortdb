import { Fn } from '../extension.js';

/**
 * Turns an array into a sequence of its elements, wraps a scalar in a single-element array, and returns an empty array for `null`/`undefined`.
 * Typically used as a tuple source to expand nested arrays into rows.
 */
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
