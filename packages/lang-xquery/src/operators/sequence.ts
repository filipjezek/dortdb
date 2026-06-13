import { Operator } from '@dortdb/core';
import { shortcutNulls } from '@dortdb/core/utils';

/**
 * XQuery range expression `to` — produces an ascending integer sequence from
 * `a` to `b` inclusive. Returns an empty array when either operand is `null`.
 */
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
