import { Castable } from '../extension.js';
import { shortcutNulls } from '../utils/shortcut-nulls.js';

export const toStr: Castable = {
  name: 'string',
  pure: true,
  convert: shortcutNulls((val) => {
    return String(val);
  }),
};
export const toNumber: Castable = {
  name: 'number',
  pure: true,
  convert(val) {
    const res = +val;
    return isNaN(res) ? null : res;
  },
};
export const toBool: Castable = {
  name: 'boolean',
  pure: true,
  convert(val) {
    return Boolean(val);
  },
};
export const toDate: Castable = {
  name: 'date',
  pure: true,
  convert: shortcutNulls((val) => {
    const res = new Date(val);
    return isNaN(res.getTime()) ? null : res;
  }),
};
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
