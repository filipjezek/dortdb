import { ASTIdentifier } from '../ast.js';
import { Calculation, FnCall, RenameMap } from '../plan/operators/index.js';
import { OpOrId } from '../plan/visitor.js';

export interface IndexMatchInput {
  expr: OpOrId;
  containingFn: FnCall;
}

export interface EqIndexAccessor {
  value: unknown;
}

export interface Index<Accessor = EqIndexAccessor> {
  expressions: (Calculation | ASTIdentifier)[];

  reindex(values: Iterable<unknown>): void;
  query(value: Accessor): Iterable<unknown>;
  /**
   * Can the index be used to match the given expressions?
   * @param expressions - expressions to match against the index
   * @param renameMap - rename the expressions before matching
   * @returns - ordered indices of the expressions that can be matched, or null if none can be matched
   */
  match(expressions: IndexMatchInput[], renameMap?: RenameMap): number[] | null;

  /**
   * Create an accessor for the given expressions.
   * @param expressions - expressions matched by {@link match}
   */
  createAccessor(expressions: IndexMatchInput[]): Calculation;
}

export interface RangeIndexAccessor {
  min?: unknown;
  max?: unknown;
  minExclusive?: boolean;
  maxExclusive?: boolean;
}

export interface RangeIndex
  extends Index<EqIndexAccessor | RangeIndexAccessor> {
  getMin(): unknown;
  getMax(): unknown;
}

export * from './map-index.js';
