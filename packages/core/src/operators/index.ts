import { Operator } from '../extension.js';
import * as arithmetic from './arithmetic.js';

export const operators: Operator[] = [...Object.values(arithmetic)];
