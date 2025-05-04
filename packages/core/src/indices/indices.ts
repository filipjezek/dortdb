import { Calculation } from '../plan/operators/index.js';
import { PlanOperator } from '../plan/visitor.js';

export interface Index {
  expressions: Calculation[];

  query(value: unknown): Iterable<unknown>;
  create(values: Iterable<unknown>): void;
  /**
   * Can the index be used to match the given expressions?
   * @param expressions - expressions to match against the index
   * @returns - ordered indices of the expressions that can be matched, or null if none can be matched
   */
  match(expressions: PlanOperator[]): number[] | null;
}

export interface RangeIndex extends Index {
  rangeQuery({ min, max }: { min?: unknown; max?: unknown }): Iterable<unknown>;
  getMin(): unknown;
  getMax(): unknown;
}
