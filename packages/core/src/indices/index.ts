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
   * @returns - a calculation returning iterable of matched values
   */
  createAccessor(expressions: IndexMatchInput[]): Calculation;
}

export * from './map-index.js';
