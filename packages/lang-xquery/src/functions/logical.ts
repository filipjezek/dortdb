import { Fn } from '@dortdb/core';
import { toBool } from '../castables/basic-types.js';

/** XQuery `fn:not()` - negates the effective boolean value of its argument. */
export const not: Fn = {
  name: 'not',
  impl: (item) => !toBool.convert(item),
  pure: true,
};

/** XQuery `fn:true()` - always returns `true`. */
export const trueFn: Fn = {
  name: 'true',
  impl: () => true,
  pure: true,
};

/** XQuery `fn:false()` - always returns `false`. */
export const falseFn: Fn = {
  name: 'false',
  impl: () => false,
  pure: true,
};
