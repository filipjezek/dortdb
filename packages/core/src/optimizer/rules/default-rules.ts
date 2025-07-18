import { PatternRule, PatternRuleConstructor } from '../rule.js';
import { IndexScans } from './index-scans.js';
import { JoinIndices } from './join-indices.js';
import { MergeProjections } from './merge-projections.js';
import { productsToJoins } from './products-to-joins.js';
import { ProjConcatToJoin } from './remove-projection-concat.js';
import { PushdownSelections } from './selection-pushdown.js';
import { mergeFromToItems, mergeToFromItems } from './to-from-items.js';
import { UnnestSubqueries } from './unnest-subqueries.js';

export const defaultRules: (
  | PatternRule<any>
  | PatternRuleConstructor<PatternRule<any>>
)[] = [
  UnnestSubqueries,
  mergeToFromItems,
  mergeFromToItems,
  PushdownSelections,
  ProjConcatToJoin,
  productsToJoins,
  JoinIndices,
  IndexScans,
  MergeProjections,
];
