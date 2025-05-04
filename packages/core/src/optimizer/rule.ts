import { DortDBAsFriend } from '../db.js';
import { PlanOperator } from '../plan/visitor.js';

export interface PatternRuleMatchResult<T> {
  bindings: T;
}

export interface PatternRule<T extends PlanOperator = PlanOperator, U = any> {
  operator: (new (...args: any[]) => T) | (new (...args: any[]) => T)[] | null;
  match(node: T): PatternRuleMatchResult<U> | null;
  transform(node: T, bindings: U): PlanOperator;
}

export interface PatternRuleConstructor<T extends PatternRule = PatternRule> {
  new (db: DortDBAsFriend): T;
}
