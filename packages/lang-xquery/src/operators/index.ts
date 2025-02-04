import { Operator } from '@dortdb/core';
import * as sequence from './sequence.js';

export const operators: Operator[] = [...Object.values(sequence)];
