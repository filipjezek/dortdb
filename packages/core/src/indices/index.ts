import { ASTIdentifier } from '../ast.js';
import { Calculation, FnCall, RenameMap } from '../plan/operators/index.js';
import { OpOrId } from '../plan/visitor.js';

export interface IndexMatchInput {
  expr: OpOrId;
  containingFn: FnCall;
}

export interface Index {
  expressions: (Calculation | ASTIdentifier)[];

  reindex(values: Iterable<unknown>): void;
  query(value: unknown): Iterable<unknown>;
  /**
   * Can the index be used to match the given expressions?
   * @param expressions - expressions to match against the index
   * @param renameMap - rename the expressions before matching
   * @returns - ordered indices of the expressions that can be matched, or null if none can be matched
   */
  match(expressions: IndexMatchInput[], renameMap?: RenameMap): number[] | null;
}

export interface RangeQueryOptions {
  min?: unknown;
  max?: unknown;
  minExclusive?: boolean;
  maxExclusive?: boolean;
}

export interface RangeIndex extends Index {
  rangeQuery(options: RangeQueryOptions): Iterable<unknown>;
  getMin(): unknown;
  getMax(): unknown;
}

export * from './map-index.js';
