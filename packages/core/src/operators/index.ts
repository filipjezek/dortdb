import { Operator } from '../extension.js';
import * as arithmetic from './arithmetic.js';
import * as relational from './relational.js';

export const operators: Operator[] = [
  ...Object.values(arithmetic),
  ...Object.values(relational),
];
