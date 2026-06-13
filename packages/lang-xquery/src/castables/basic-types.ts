import { Castable } from '@dortdb/core';

/**
 * Implements XQuery's effective boolean value (EBV) cast: a single-item sequence
 * coerces to its boolean value; a multi-item sequence is `true`; an empty sequence
 * is `false`.
 */
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
