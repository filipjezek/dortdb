import { Operator } from '@dortdb/core';
import { isMatch } from 'es-toolkit/compat';
import { shortcutNulls } from '@dortdb/core/utils';

/**
 * SQL `->` operator; accesses a property of an object or element by key,
 * returning `null` for non-object/non-string inputs.
 */
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

/** SQL `@>` containment operator; returns `true` when the left object contains all key-value pairs of the right object. */
export const objMatch: Operator = {
  name: '@>',
  impl: shortcutNulls(isMatch),
};
