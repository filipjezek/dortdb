import { ASTNode } from '@dortdb/core';
import { SQLVisitor } from './visitor.js';
import { SQLIdentifier } from './expression.js';

/** Traversal order for recursive CTEs (`SEARCH` clause). */
export enum SearchType {
  /** Depth-first search order. */
  DFS = 'dfs',
  /** Breadth-first search order. */
  BFS = 'bfs',
}

/**
 * A single CTE definition inside a `WITH` clause.
 */
export class WithQuery implements ASTNode {
  /** `true` when the `RECURSIVE` keyword was present. */
  public recursive = false;

  /** Columns tracked for the `SEARCH` ordering; `undefined` if no `SEARCH` clause. */
  public searchCols: SQLIdentifier[];
  /** Traversal order for the `SEARCH` clause. */
  public searchType = SearchType.BFS;
  /** Column name that holds the search order sequence. */
  public searchName: SQLIdentifier;

  /** Columns tracked for cycle detection; `undefined` if no `CYCLE` clause. */
  public cycleCols: SQLIdentifier[];
  /** Column name used to mark cycled rows. */
  public cycleMarkName: SQLIdentifier;
  /** Column name holding the path of cycle ancestors. */
  public cyclePathName: SQLIdentifier;
  /** Value assigned to the cycle mark column when a cycle is detected. */
  public cycleMarkVal: ASTNode;
  /** Value assigned to the cycle mark column for non-cycled rows. */
  public cycleMarkDefault: ASTNode;

  constructor(
    /** The CTE name. */
    public name: SQLIdentifier,
    /** Optional explicit column names; `null` if not specified. */
    public colNames: SQLIdentifier[],
    /** The CTE body query. */
    public query: ASTNode,
    /** `true` to force materialization, `false` to force inlining, `undefined` to let the optimizer decide. */
    public materialized?: boolean,
  ) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitWithQuery(this, arg);
  }
}
