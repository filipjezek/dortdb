import { Castable } from '../extension.js';

export const BasicCastables: Castable[] = [
  {
    name: 'string',
    pure: true,
    convert(val) {
      return String(val);
    },
  },
  {
    name: 'number',
    pure: true,
    convert(val) {
      const res = +val;
      return isNaN(res) ? null : res;
    },
  },
  {
    name: 'boolean',
    pure: true,
    convert(val) {
      return Boolean(val);
    },
  },
  {
    name: 'date',
    pure: true,
    convert(val) {
      const res = new Date(val);
      return isNaN(res.getTime()) ? null : res;
    },
  },
  {
    name: 'json',
    convert(val) {
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    },
  },
];
