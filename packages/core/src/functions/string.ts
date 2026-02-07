import { Fn } from '../extension.js';
import { shortcutNulls } from '../utils/shortcut-nulls.js';

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

export const slice: Fn = {
  name: 'slice',
  impl: shortcutNulls((str: string, start: number, end?: number): string => {
    return str.slice(start, end);
  }),
  pure: true,
};
