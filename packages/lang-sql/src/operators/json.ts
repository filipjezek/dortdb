import { Operator } from '@dortdb/core';
import { isMatch } from 'es-toolkit/compat';
import { shortcutNulls } from '@dortdb/core/utils';

export const objAccess: Operator = {
  name: '->',
  impl: shortcutNulls(
    (obj: Record<string, unknown>, key: string | number): unknown => {
      if (typeof obj !== 'object' && typeof obj !== 'string') return null;
      if (Array.isArray(obj)) return obj.at(key as number);
      if (obj instanceof Element)
        return obj.getAttribute(key as string) ?? obj[key];
      return obj[key];
    },
  ),
};

export const objMatch: Operator = {
  name: '@>',
  impl: shortcutNulls(isMatch),
};
