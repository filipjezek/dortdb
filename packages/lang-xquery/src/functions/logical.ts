import { Fn } from '@dortdb/core';

export const not: Fn = {
  name: 'not',
  impl: (item: any) => !item,
};

export const trueFn: Fn = {
  name: 'true',
  impl: () => true,
};

export const falseFn: Fn = {
  name: 'false',
  impl: () => false,
};
