import { Fn } from '../extension.js';
import { shortcutNulls } from '../utils/shortcut-nulls.js';

/** Returns a substring starting at `start`; if `length` is given, at most `length` characters are returned. Propagates `null`. */
export const substr: Fn = {
  name: 'substr',
  impl: shortcutNulls((str: string, start: number, length?: number): string => {
    if (length === undefined) {
      return str.slice(start);
    }
    return str.slice(start, start + length);
  }),
  pure: true,
};

/** Returns the portion of a string from `start` up to (but not including) `end`; negative indices count from the end. Propagates `null`. */
export const slice: Fn = {
  name: 'slice',
  impl: shortcutNulls((str: string, start: number, end?: number): string => {
    return str.slice(start, end);
  }),
  pure: true,
};
