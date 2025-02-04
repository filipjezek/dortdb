import { Operator } from '@dortdb/core';

export const to: Operator = {
  name: 'to',
  impl: (a: any, b: any) => {
    a = +a;
    b = +b;
    const res: number[] = [];
    for (let i = a; i <= b; i++) {
      res.push(i);
    }
    return res;
  },
};
