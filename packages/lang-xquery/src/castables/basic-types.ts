import { Castable } from '@dortdb/core';

export const toBool: Castable = {
  name: 'boolean',
  pure: true,
  convert(val) {
    if (Array.isArray(val)) {
      if (val.length === 1) val = val[0];
      else return val.length > 0;
    }
    return !!val;
  },
};
