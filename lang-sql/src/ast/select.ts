import { ASTNode } from '@dortdb/core';
import { SQLVisitor } from './visitor.js';
import { ASTTableAlias } from './alias.js';

export class SelectStatement implements ASTNode {
  // orderBy?: OrderByItem[];
  // limit?: ASTNode;
  // offset?: ASTNode;
  // selectSet: SelectSet;

  constructor(
    public selectSet: SelectSet,
    public orderBy?: OrderByItem[],
    public limit?: ASTNode,
    public offset?: ASTNode
  ) {}

  accept(visitor: SQLVisitor): void {
    visitor.visitSelectStatement(this);
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
    public distinct: boolean | ASTNode[] = false
  ) {}

  accept(visitor: SQLVisitor): void {
    visitor.visitSelectSet(this);
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

  accept(visitor: SQLVisitor): void {
    visitor.visitSelectSetOp(this);
  }
}

export class OrderByItem implements ASTNode {
  public ascending: boolean;

  constructor(
    public expression: ASTNode,
    direction?: string,
    public nullsFirst?: boolean
  ) {
    this.ascending =
      direction === undefined || direction.toLowerCase() === 'asc';
    if (nullsFirst === undefined) {
      this.nullsFirst = !this.ascending;
    }
  }

  accept(visitor: SQLVisitor): void {
    visitor.visitOrderByItem(this);
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

  accept(visitor: SQLVisitor): void {
    visitor.visitGroupByClause(this);
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

  accept(visitor: SQLVisitor): void {
    visitor.visitJoinClause(this);
  }
}

export class JoinUsing implements ASTNode {
  constructor(public columns: ASTNode[]) {}

  accept(visitor: SQLVisitor): void {
    visitor.visitJoinUsing(this);
  }
}

export class ValuesClause implements ASTNode {
  constructor(public values: ASTNode[][]) {}

  accept(visitor: SQLVisitor): void {
    visitor.visitValues(this);
  }
}
