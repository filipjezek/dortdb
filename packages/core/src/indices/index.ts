import { DortDBAsFriend } from '../db.js';
import { Calculation, FnCall, RenameMap } from '../plan/operators/index.js';
import { OpOrId } from '../plan/visitor.js';
import { Executor } from '../visitors/executor.js';

export interface IndexMatchInput {
  expr: OpOrId;
  containingFn: FnCall;
}
export interface IndexFillInput {
  /** the source item */
  value: unknown;
  /** results of the index expressions */
  keys: unknown[];
}

export const fromItemIndexKey = Symbol('fromItemIndexKey');

/**
 * Represents a secondary index on a data structure.
 */
export interface Index {
  /** The indexed expressions. More expressions result in multi-level index. */
  expressions: Calculation[];

  /**
   * Rebuild the index with new values.
   * @param values - the new values to index
   */
  reindex(values: Iterable<IndexFillInput>): void;
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

/** Used in hash join in {@link Executor} */
export interface HashJoinIndexStatic {
  /**
   * Determines if the index can be used to index the given expressions.
   * @param expressions - expressions to check
   * @returns - ordered indices of the expressions that can be indexed, or null if none can be indexed
   */
  canIndex(expressions: IndexMatchInput[]): number[] | null;

  new (expressions: Calculation[], db: DortDBAsFriend): HashJoinIndex;
}

export interface HashJoinIndex extends Index {
  /** Iterate over all stored values. Used in full outer joins. */
  allValues(): Iterable<unknown[]>;
}

export * from './map-index.js';
