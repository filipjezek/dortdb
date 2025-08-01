import { Extension } from '../../extension.js';
import { dateAdd, dateSub, extract, interval, now } from './functions.js';

export const datetime: Extension = {
  functions: [now, interval, dateAdd, dateSub, extract],
};
