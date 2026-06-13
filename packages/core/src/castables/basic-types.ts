import { Castable } from '../extension.js';
import { shortcutNulls } from '../utils/shortcut-nulls.js';

/** Casts any value to a string via `String()`; propagates `null`/`undefined` as `null`. */
export const toStr: Castable = {
  name: 'string',
  pure: true,
  convert: shortcutNulls((val) => {
    return String(val);
  }),
};
/** Casts any value to a number using the unary `+` operator; returns `null` for `NaN` or null input. */
export const toNumber: Castable = {
  name: 'number',
  pure: true,
  convert(val) {
    const res = +val;
    return isNaN(res) ? null : res;
  },
};
/** Casts any value to a boolean via `Boolean()`; never returns `null`. */
export const toBool: Castable = {
  name: 'boolean',
  pure: true,
  convert(val) {
    return Boolean(val);
  },
};
/** Casts any value to a `Date`; returns `null` for null/undefined input or an invalid date string. */
export const toDate: Castable = {
  name: 'date',
  pure: true,
  convert: shortcutNulls((val) => {
    const res = new Date(val);
    return isNaN(res.getTime()) ? null : res;
  }),
};
/** Parses a JSON string; returns `null` for null/undefined input or malformed JSON. */
export const toJson: Castable = {
  name: 'json',
  convert: shortcutNulls((val) => {
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }),
};
