import { createCustomEqual } from 'fast-equals';
import type { EqualityComparator } from 'fast-equals';

const rtol = 1e-9;
const atol = 1e-9;

function createAreNumbersEqual(
  areNumbersEqual: EqualityComparator<any>,
): EqualityComparator<any> {
  return function (a, b, state) {
    if (!isNaN(a) && !isNaN(b)) {
      if (a % 1 !== 0 || b % 1 !== 0) {
        // Compare numbers with a tolerance to account for floating point precision issues
        const res =
          Math.abs(a - b) <= atol + rtol * Math.max(Math.abs(a), Math.abs(b));
        // if (!res) {
        //   console.error(
        //     `Numbers ${a} and ${b} differ more than the allowed tolerance.`,
        //   );
        // }
        return res;
      }
    }
    return areNumbersEqual(a, b, state);
  };
}

export const deepEqual = createCustomEqual({
  createCustomConfig: ({ areNumbersEqual }) => ({
    areNumbersEqual: createAreNumbersEqual(areNumbersEqual),
  }),
});
