import { DortDBAsFriend } from '../db.js';
import { Calculation, FnCall, RenameMap } from '../plan/operators/index.js';
import { OpOrId } from '../plan/visitor.js';
import { Executor } from '../visitors/executor.js';

/**
 * Describes a single expression to match against an index, together with
 * the operator call that wraps it.
 */
export interface IndexMatchInput {
  /** The expression being tested (the operand to `containingFn`). */
  expr: OpOrId;
  /** The operator call (e.g. an equality check) that contains `expr`. */
  containingFn: FnCall;
}
/** Input record supplied to {@link Index.reindex} for each source item. */
export interface IndexFillInput {
  /** the source item */
  value: unknown;
  /** results of the index expressions */
  keys: unknown[];
}

/** Symbol attached to index-entry objects to recover the original source item. */
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
