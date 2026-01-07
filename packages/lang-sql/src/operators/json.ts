import { Operator } from '@dortdb/core';
import { isMatch } from 'es-toolkit/compat';

export const objAccess: Operator = {
  name: '->',
  impl: (obj: Record<string, unknown>, key: string | number): unknown => {
    if ((typeof obj !== 'object' && typeof obj !== 'string') || obj === null)
      return undefined;
    if (Array.isArray(obj)) return obj.at(key as number);
    if (obj instanceof Element)
      return obj.getAttribute(key as string) ?? obj[key];
    return obj[key];
  },
};

export const objMatch: Operator = {
  name: '@>',
  impl: isMatch,
};
