import { ASTFunction, ASTNode } from '@dortdb/core';
import { SQLVisitor } from './visitor.js';
import { ASTTableAlias } from './alias.js';
import { ASTIdentifier } from './expression.js';
import { WithQuery } from './with.js';

export class SelectStatement implements ASTNode {
  constructor(
    public selectSet: SelectSet,
    public orderBy?: OrderByItem[],
    public limit?: ASTNode,
    public offset?: ASTNode,
    public withQueries?: WithQuery[]
  ) {}

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitSelectStatement(this);
  }
}

export class SelectSet implements ASTNode {
  setOp?: SelectSetOp;

  constructor(
    public items: ASTNode[],
    public from?: ASTNode,
    public where?: ASTNode,
    public groupBy?: GroupByClause,
    public having?: ASTNode,
    public distinct: boolean | ASTNode[] = false,
    public windows?: ASTNode[]
  ) {}

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitSelectSet(this);
  }
}

export enum SelectSetOpType {
  UNION = 'union',
  INTERSECT = 'intersect',
  EXCEPT = 'except',
}

export class SelectSetOp implements ASTNode {
  type: SelectSetOpType;
  distinct: boolean;

  constructor(public next: SelectStatement, distinct: string, type: string) {
    this.distinct = distinct?.toLowerCase() === 'distinct';
    this.type = type.toLowerCase() as SelectSetOpType;
  }

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitSelectSetOp(this);
  }
}

export class OrderByItem {
  public ascending: boolean;
  public nullsFirst: boolean;

  constructor(
    public expression: ASTNode,
    direction?: string,
    nullsFirst?: boolean
  ) {
    this.ascending =
      direction === undefined || direction.toLowerCase() === 'asc';
    this.nullsFirst = nullsFirst ?? !this.ascending;
  }
}

export enum GroupByType {
  BASIC = 'basic',
  ROLLUP = 'rollup',
  CUBE = 'cube',
  GROUPINGSETS = 'groupingsets',
}
export class GroupByClause implements ASTNode {
  constructor(
    public items: ASTNode[] | ASTNode[][],
    public type: GroupByType
  ) {}

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitGroupByClause(this);
  }
}

export enum JoinType {
  INNER = 'inner',
  LEFT = 'left',
  RIGHT = 'right',
  FULL = 'full',
  CROSS = 'cross',
}
export class JoinClause implements ASTNode {
  public condition?: ASTNode;
  public using?: ASTNode[] | ASTTableAlias;
  public natural = false;

  constructor(
    public table: ASTNode,
    public joinType: JoinType,
    joinCond?: ASTNode | ASTNode[],
    public lateral = false
  ) {
    if (joinCond instanceof Array || joinCond instanceof ASTTableAlias) {
      this.using = joinCond;
    } else {
      this.condition = joinCond;
    }
  }

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitJoinClause(this);
  }
}

export class ValuesClause implements ASTNode {
  constructor(public values: ASTNode[][]) {}

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitValues(this);
  }
}

export class TableFn extends ASTFunction {
  constructor(
    id: ASTIdentifier,
    args: ASTNode[],
    public withOrdinality = false
  ) {
    super('sql', id, args);
  }

  override accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitTableFn(this);
  }
}

export class RowsFrom implements ASTNode {
  constructor(public tableFns: TableFn[], public withOrdinality = false) {}

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitRowsFrom(this);
  }
}
