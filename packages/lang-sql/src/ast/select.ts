import { ASTFunction, ASTNode } from '@dortdb/core';
import { SQLVisitor } from './visitor.js';
import { ASTTableAlias } from './alias.js';
import { ASTIdentifier } from '@dortdb/core';
import { WithQuery } from './with.js';
import { SQLIdentifier as ASTIdentifierClass } from './expression.js';
import { WindowSpec } from './window.js';

export class SelectStatement implements ASTNode {
  constructor(
    public selectSet: SelectSet | ValuesClause,
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
    public from?: ASTIdentifierClass | ASTTableAlias | JoinClause,
    public where?: ASTNode,
    public groupBy?: GroupByClause,
    public having?: ASTNode,
    public distinct: boolean | ASTNode[] = false,
    public windows?: Record<string, WindowSpec>
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

  constructor(public next: SelectSet, public distinct: boolean, type: string) {
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
  GROUPINGSETS = 'grouping sets',
}
export class GroupByClause implements ASTNode {
  public type: GroupByType;
  constructor(public items: ASTNode[] | ASTNode[][], type: string) {
    this.type = type.toLowerCase() as GroupByType;
  }

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
  public using?: ASTIdentifier[];
  public natural = false;

  constructor(
    public tableLeft: ASTTableAlias | ASTIdentifier | JoinClause,
    public tableRight: ASTTableAlias | ASTIdentifier | JoinClause,
    public joinType: JoinType,
    joinCond?: ASTNode | ASTIdentifier[],
    public lateral = false
  ) {
    if (joinCond instanceof Array) {
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
