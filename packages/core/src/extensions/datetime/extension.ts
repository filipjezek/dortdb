import { Extension } from '../../extension.js';
import { dateAdd, dateSub, interval, now } from './functions.js';

export const datetime: Extension = {
  functions: [now, interval, dateAdd, dateSub],
};
