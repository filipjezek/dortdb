import { Fn } from '../extension.js';

export const substr: Fn = {
  name: 'substr',
  impl: (str: string, start: number, length?: number): string => {
    if (length === undefined) {
      return str.slice(start);
    }
    return str.slice(start, start + length);
  },
  pure: true,
};

export const slice: Fn = {
  name: 'slice',
  impl: (str: string, start: number, end?: number): string => {
    return str.slice(start, end);
  },
  pure: true,
};
