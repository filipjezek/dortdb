import { Castable } from '@dortdb/core';
import { toBool } from './basic-types.js';

/** All XQuery castables registered with the language instance. */
export const castables: Castable[] = [toBool];
