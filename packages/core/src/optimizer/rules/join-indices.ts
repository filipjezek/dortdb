import * as plan from '../../plan/operators/index.js';
import { PlanOperator } from '../../plan/visitor.js';
import { PatternRule, PatternRuleMatchResult } from '../rule.js';

export interface JoinIndicesBindings {}

export class JoinIndices
  implements PatternRule<plan.Join, JoinIndicesBindings>
{
  operator = plan.Join;

  match(node: plan.Join): PatternRuleMatchResult<JoinIndicesBindings> {
    throw new Error('Method not implemented.');
  }
  transform(node: plan.Join, bindings: JoinIndicesBindings): PlanOperator {
    throw new Error('Method not implemented.');
  }
}
