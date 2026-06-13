import { Operator } from '@dortdb/core';
import { likeToRegex } from '../utils/string.js';
import { shortcutNulls } from '@dortdb/core/utils';

/** SQL `||` operator; concatenates arrays via `Array.concat` or coerces operands to strings. */
export const concat: Operator = {
  name: '||',
  impl: shortcutNulls((a, b) => {
    if (Array.isArray(a)) return a.concat(b);
    if (Array.isArray(b)) return b.concat(a);
    return a + b;
  }),
};

/** SQL `LIKE` operator; tests a string against a case-sensitive pattern, mapping `%` to `.*` and `_` to `.`. */
export const like: Operator = {
  name: 'like',
  impl: shortcutNulls((a, b) => {
    a = a.toString();
    const regex = b instanceof RegExp ? b : likeToRegex(b.toString(), true);
    return regex.test(a);
  }),
};
/** SQL `ILIKE` operator; case-insensitive variant of {@link like}. */
export const ilike: Operator = {
  name: 'ilike',
  impl: shortcutNulls((a, b) => {
    a = a.toString();
    const regex = b instanceof RegExp ? b : likeToRegex(b.toString(), false);
    return regex.test(a);
  }),
};
