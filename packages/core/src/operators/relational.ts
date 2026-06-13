import { Operator } from '../extension.js';
import { shortcutNulls } from '../utils/shortcut-nulls.js';

/** Loose equality (`==`); propagates `null`. */
export const eq: Operator = {
  name: '=',
  impl: shortcutNulls((a, b) => a == b),
};

/** Loose inequality (`!=`); propagates `null`. */
export const neq: Operator = {
  name: '!=',
  impl: shortcutNulls((a, b) => a != b),
};

/** Alias of {@link neq} using the `<>` syntax. */
export const neq2: Operator = {
  name: '<>',
  impl: neq.impl,
};

/** Greater-than comparison; propagates `null`. */
export const gt: Operator = {
  name: '>',
  impl: shortcutNulls((a, b) => a > b),
};

/** Less-than comparison; propagates `null`. */
export const lt: Operator = {
  name: '<',
  impl: shortcutNulls((a, b) => a < b),
};

/** Greater-than-or-equal comparison; propagates `null`. */
export const ge: Operator = {
  name: '>=',
  impl: shortcutNulls((a, b) => a >= b),
};

/** Less-than-or-equal comparison; propagates `null`. */
export const le: Operator = {
  name: '<=',
  impl: shortcutNulls((a, b) => a <= b),
};

/** Strict equality (`===`); does not propagate `null`, so it can meaningfully compare null values. */
export const isOp: Operator = {
  name: 'is',
  impl: (a: unknown, b: unknown): boolean => {
    return a === b;
  },
};
