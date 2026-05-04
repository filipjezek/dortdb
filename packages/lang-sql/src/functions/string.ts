import { Fn } from '@dortdb/core';
import { substr as substrOrig } from '@dortdb/core/fns';

export const substr: Fn = {
  name: 'substr',
  pure: true,
  // In SQL, the start index is 1-based
  impl: (str: string, start: number, length?: number) =>
    substrOrig.impl(str, start - 1, length),
};
