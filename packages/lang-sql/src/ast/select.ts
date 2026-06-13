import { ASTFunction, ASTNode } from '@dortdb/core';
import { SQLVisitor } from './visitor.js';
import { ASTTableAlias } from './alias.js';
import { ASTIdentifier } from '@dortdb/core';
import { WithQuery } from './with.js';
import { SQLIdentifier as ASTIdentifierClass } from './expression.js';
import { WindowSpec } from './window.js';

/**
 * A complete SQL `SELECT` statement, including optional `WITH`, `ORDER BY`, `LIMIT`, and `OFFSET` clauses.
 */
export class SelectStatement implements ASTNode {
  constructor(
    /** The primary query body. */
    public selectSet: SelectSet | ValuesClause,
    /** Top-level `ORDER BY`; `null` if omitted. */
    public orderBy: OrderByItem[] = null,
    /** The `LIMIT` expression; `null` if omitted. */
    public limit: ASTNode = null,
    /** The `OFFSET` expression; `null` if omitted. */
    public offset: ASTNode = null,
    /** `WITH` (CTE) definitions; `null` if no `WITH` clause is present. */
    public withQueries: WithQuery[] = null,
  ) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSelectStatement(this, arg);
  }
}

/**
 * One `SELECT` body, covering its projection, source, filter, grouping, and window definitions.
 */
export class SelectSet implements ASTNode {
  /** Linked `UNION`/`INTERSECT`/`EXCEPT` operation following this set; `undefined` if this is the last set. */
  setOp?: SelectSetOp;

  constructor(
    /** The projection list (the expressions after `SELECT`). */
    public items: ASTNode[],
    /** The primary table source; `null` for a `SELECT` with no `FROM`. */
    public from: ASTIdentifierClass | ASTTableAlias | JoinClause = null,
    /** `WHERE` predicate; `null` if omitted. */
    public where: ASTNode = null,
    /** `GROUP BY` clause; `null` if omitted. */
    public groupBy: GroupByClause = null,
    /** `HAVING` predicate; `null` if omitted. */
    public having: ASTNode = null,
    /** `false` for no `DISTINCT`, `true` for `DISTINCT`, or an expression list for `DISTINCT ON (…)`. */
    public distinct: boolean | ASTNode[] = false,
    /** Named window definitions from the `WINDOW` clause; `null` if none are defined. */
    public windows: Record<string, WindowSpec> = null,
  ) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSelectSet(this, arg);
  }
}

/** The set-operation type joining two query bodies. */
export enum SelectSetOpType {
  /** SQL `UNION`. */
  UNION = 'union',
  /** SQL `INTERSECT`. */
  INTERSECT = 'intersect',
  /** SQL `EXCEPT`. */
  EXCEPT = 'except',
}

/**
 * A set operation linking this query body to the next.
 */
export class SelectSetOp implements ASTNode {
  /** The operation type (`UNION`, `INTERSECT`, or `EXCEPT`). */
  type: SelectSetOpType;

  constructor(
    /** The following `SELECT` body. */
    public next: SelectSet,
    /** `true` for `UNION/INTERSECT/EXCEPT DISTINCT`, `false` for `ALL`. */
    public distinct: boolean,
    type: string,
  ) {
    this.type = type.toLowerCase() as SelectSetOpType;
  }

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSelectSetOp(this, arg);
  }
}

/**
 * A single expression in an `ORDER BY` clause with direction and nulls ordering.
 */
export class OrderByItem {
  /** `true` for `ASC` (default), `false` for `DESC`. */
  public ascending: boolean;
  /** `true` when `NULLS FIRST` is in effect; defaults to `true` for `DESC`, `false` for `ASC`. */
  public nullsFirst: boolean;

  constructor(
    /** The sort expression. */
    public expression: ASTNode,
    direction?: string,
    nullsFirst?: boolean,
  ) {
    this.ascending =
      direction === undefined || direction.toLowerCase() === 'asc';
    this.nullsFirst = nullsFirst ?? !this.ascending;
  }
}

/** The grouping mode for a `GROUP BY` clause. */
export enum GroupByType {
  /** Plain `GROUP BY expr, …`. */
  BASIC = 'basic',
  /** `GROUP BY ROLLUP(…)`. */
  ROLLUP = 'rollup',
  /** `GROUP BY CUBE(…)`. */
  CUBE = 'cube',
  /** `GROUP BY GROUPING SETS(…)`. */
  GROUPINGSETS = 'grouping sets',
}
/**
 * A `GROUP BY` clause with its mode and grouping expressions.
 */
export class GroupByClause implements ASTNode {
  /** The grouping mode. */
  public type: GroupByType;
  constructor(
    /** Grouping expressions; a flat list for `BASIC`, `ROLLUP`, and `CUBE`, or a list of lists for `GROUPING SETS`. */
    public items: ASTNode[] | ASTNode[][],
    type: string,
  ) {
    this.type = type.toLowerCase() as GroupByType;
  }

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitGroupByClause(this, arg);
  }
}

/** SQL join variant. */
export enum JoinType {
  /** `INNER JOIN`. */
  INNER = 'inner',
  /** `LEFT [OUTER] JOIN`. */
  LEFT = 'left',
  /** `RIGHT [OUTER] JOIN`. */
  RIGHT = 'right',
  /** `FULL [OUTER] JOIN`. */
  FULL = 'full',
  /** `CROSS JOIN`. */
  CROSS = 'cross',
}
/**
 * A join between two table sources.
 */
export class JoinClause implements ASTNode {
  /** `ON` join predicate; `undefined` when `USING` or `NATURAL` is used. */
  public condition?: ASTNode;
  /** `USING` column list; `undefined` when `ON` or `NATURAL` is used. */
  public using?: ASTIdentifier[];
  /** `true` when the `NATURAL` keyword was present. */
  public natural = false;

  constructor(
    /** The left-hand table source. */
    public tableLeft: ASTTableAlias | ASTIdentifier | JoinClause,
    /** The right-hand table source. */
    public tableRight: ASTTableAlias | ASTIdentifier | JoinClause,
    /** The join variant. */
    public joinType: JoinType,
    joinCond?: ASTNode | ASTIdentifier[],
    /** `true` when the right side is a `LATERAL` expression. */
    public lateral = false,
  ) {
    if (joinCond instanceof Array) {
      this.using = joinCond;
    } else {
      this.condition = joinCond;
    }
  }

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitJoinClause(this, arg);
  }
}

/**
 * A `VALUES (…), …` clause providing inline row data.
 */
export class ValuesClause implements ASTNode {
  constructor(
    /** The rows, each an array of column expressions. */
    public values: ASTNode[][],
  ) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitValues(this, arg);
  }
}

/**
 * A set-returning function in the `FROM` clause, extending {@link ASTFunction}.
 */
export class TableFn extends ASTFunction {
  constructor(
    id: ASTIdentifier,
    args: ASTNode[],
    /** `true` when `WITH ORDINALITY` was specified, adding an ordinal column. */
    public withOrdinality = false,
  ) {
    super('sql', id, args);
  }

  override accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitTableFn(this, arg);
  }
}

/**
 * `ROWS FROM(…)` multi-function table source.
 */
export class RowsFrom implements ASTNode {
  constructor(
    /** The set-returning functions whose rows are zipped together. */
    public tableFns: TableFn[],
    /** `true` when `WITH ORDINALITY` appends an ordinal column. */
    public withOrdinality = false,
  ) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitRowsFrom(this, arg);
  }
}
