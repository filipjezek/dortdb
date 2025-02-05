import { Castable } from '../extension.js';

export const toStr: Castable = {
  name: 'string',
  pure: true,
  convert(val) {
    return String(val);
  },
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
  convert(val) {
    const res = new Date(val);
    return isNaN(res.getTime()) ? null : res;
  },
};
export const toJson: Castable = {
  name: 'json',
  convert(val) {
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  },
};
