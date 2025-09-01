import { Extension } from '../../extension.js';
import { dateAdd, dateSub, extract, interval, now } from './functions.js';

/**
 * An extension for working with dates and times.
 */
export const datetime: Extension = {
  functions: [now, interval, dateAdd, dateSub, extract],
};
