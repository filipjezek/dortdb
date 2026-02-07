import { Operator } from '@dortdb/core';
import { shortcutNulls } from '@dortdb/core/utils';

export const to: Operator = {
  name: 'to',
  impl: shortcutNulls((a, b) => {
    a = +a;
    b = +b;
    const res: number[] = [];
    for (let i = a; i <= b; i++) {
      res.push(i);
    }
    return res;
  }, []),
};
