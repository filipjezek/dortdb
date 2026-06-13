import { DortDBAsFriend } from '../db.js';
import { PlanOperator, PlanTupleOperator } from '../plan/visitor.js';

/**
 * Represents the result of a pattern rule match.
 */
export interface PatternRuleMatchResult<T> {
  /** Captured sub-operator references and metadata produced during pattern matching. */
  bindings: T;
}

/** A tuple operator that wraps a single child plan, exposed as {@link source}. */
export interface TupleOperatorWithSource extends PlanTupleOperator {
  /** The single child operator. */
  source: PlanTupleOperator;
}

/** A tuple operator with two input branches, such as a set operation. */
export interface BranchedOperator<T extends PlanOperator = PlanOperator>
  extends PlanTupleOperator {
  /** The left input branch. */
  left: T;
  /** The right input branch. */
  right: T;
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

/** Constructor shape for {@link PatternRule} implementations that require the database interface at construction time. */
export interface PatternRuleConstructor<T extends PatternRule = PatternRule> {
  new (db: DortDBAsFriend): T;
}
