import { DortDBAsFriend } from '../db.js';
import { PlanOperator } from '../plan/visitor.js';

/**
 * Represents the result of a pattern rule match.
 */
export interface PatternRuleMatchResult<T> {
  bindings: T;
}

/**
 * Rule for the {@link Optimizer}.
 */
export interface PatternRule<T extends PlanOperator = PlanOperator, U = any> {
  /**
   * The operator this rule starts matching at.
   */
  operator: (new (...args: any[]) => T) | (new (...args: any[]) => T)[] | null;
  /**
   * Matches the given plan operator against this rule.
   * @param node The plan operator to match.
   */
  match(node: T): PatternRuleMatchResult<U> | null;
  /**
   * Transforms the given plan operator using the provided bindings.
   * @param node The plan operator to transform.
   * @param bindings The bindings to use for the transformation.
   */
  transform(node: T, bindings: U): PlanOperator;
}

export interface PatternRuleConstructor<T extends PatternRule = PatternRule> {
  new (db: DortDBAsFriend): T;
}
