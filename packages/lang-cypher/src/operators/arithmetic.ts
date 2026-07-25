import { Operator } from '@dortdb/core';
import { shortcutNulls } from '@dortdb/core/utils';

export const add: Operator = {
  name: '+',
  impl: shortcutNulls((a: any, b: any) => {
    if (Array.isArray(a) && Array.isArray(b)) {
      return [...a, ...b];
    }
    return a + b;
  }),
};
