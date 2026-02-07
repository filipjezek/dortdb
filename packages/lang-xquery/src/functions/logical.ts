import { Fn } from '@dortdb/core';
import { toBool } from '../castables/basic-types.js';

export const not: Fn = {
  name: 'not',
  impl: (item) => !toBool.convert(item),
  pure: true,
};

export const trueFn: Fn = {
  name: 'true',
  impl: () => true,
  pure: true,
};

export const falseFn: Fn = {
  name: 'false',
  impl: () => false,
  pure: true,
};
