import { DortDBAsFriend } from '../db.js';
import { LogicalPlanOperator } from '../plan/visitor.js';

export interface PatternRuleMatchResult<T> {
  bindings: T;
}

export interface PatternRule<
  T extends LogicalPlanOperator = LogicalPlanOperator,
  U = any,
> {
  operator: new (...args: any[]) => T;
  match(node: T): PatternRuleMatchResult<U> | null;
  transform(node: T, bindings: U): LogicalPlanOperator;
}

export interface PatternRuleConstructor<T extends PatternRule = PatternRule> {
  new (db: DortDBAsFriend): T;
}
