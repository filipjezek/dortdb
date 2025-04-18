import { PatternRule, PatternRuleConstructor } from '../rule.js';
import {
  ProjConcatToJoin,
  removeEmptyProjConcat,
} from './remove-projection-concat.js';
import { PushdownSelections } from './selection-pushdown.js';
import { mergeFromToItems, mergeToFromItems } from './to-from-items.js';

export const defaultRules: (
  | PatternRule<any>
  | PatternRuleConstructor<PatternRule<any>>
)[] = [
  mergeFromToItems,
  mergeToFromItems,
  PushdownSelections,
  removeEmptyProjConcat,
  ProjConcatToJoin,
];
