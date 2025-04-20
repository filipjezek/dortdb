import { PatternRule, PatternRuleConstructor } from '../rule.js';
import { MergeProjections } from './merge-projections.js';
import { ProjConcatToJoin } from './remove-projection-concat.js';
import { PushdownSelections } from './selection-pushdown.js';
import { mergeFromToItems, mergeToFromItems } from './to-from-items.js';
import { UnnestSubqueries } from './unnest-subqueries.js';

export const defaultRules: (
  | PatternRule<any>
  | PatternRuleConstructor<PatternRule<any>>
)[] = [
  UnnestSubqueries,
  mergeFromToItems,
  mergeToFromItems,
  PushdownSelections,
  ProjConcatToJoin,
  MergeProjections,
];
