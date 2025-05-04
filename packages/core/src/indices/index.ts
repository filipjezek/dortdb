import { ASTIdentifier } from '../ast.js';
import { DortDBAsFriend } from '../db.js';
import { Calculation } from '../plan/operators/index.js';
import { OpOrId } from '../plan/visitor.js';

export interface Index {
  expressions: (Calculation | ASTIdentifier)[];

  init(values: Iterable<unknown>, db: DortDBAsFriend): void;
  query(value: unknown): Iterable<unknown>;
  /**
   * Can the index be used to match the given expressions?
   * @param expressions - expressions to match against the index
   * @returns - ordered indices of the expressions that can be matched, or null if none can be matched
   */
  match(expressions: OpOrId[]): number[] | null;
}

export interface RangeIndex extends Index {
  rangeQuery({ min, max }: { min?: unknown; max?: unknown }): Iterable<unknown>;
  getMin(): unknown;
  getMax(): unknown;
}
