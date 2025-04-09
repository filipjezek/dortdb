import { PatternRule } from '../rule.js';
import { pushdownSelections } from './pushdown.js';
import { mergeFromToItems, mergeToFromItems } from './to-from-items.js';

export const defaultRules: PatternRule<any>[] = [
  mergeFromToItems,
  mergeToFromItems,
  pushdownSelections,
];
