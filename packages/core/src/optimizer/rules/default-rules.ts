import { PatternRule, PatternRuleConstructor } from '../rule.js';
import { PushdownSelections } from './pushdown.js';
import { mergeFromToItems, mergeToFromItems } from './to-from-items.js';

export const defaultRules: (
  | PatternRule<any>
  | PatternRuleConstructor<PatternRule<any>>
)[] = [mergeFromToItems, mergeToFromItems, PushdownSelections];
