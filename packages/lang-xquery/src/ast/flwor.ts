import { ASTNode } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { ASTVariable } from './expression.js';

export class FLWORExpr implements ASTNode {
  constructor(public clauses: FLWORClause[]) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitFLWORExpr(this);
  }
}

export type FLWORClause = FLWORFor | FLWORLet | FLWORWindow;

export class FLWORFor implements ASTNode {
  constructor(public bindings: FLWORForBinding[]) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitFLWORFor(this);
  }
}

export class FLWORForBinding implements ASTNode {
  constructor(
    public variable: ASTVariable,
    public expr: ASTNode,
    public allowEmpty = false,
    public posVar?: ASTVariable
  ) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitFLWORForBinding(this);
  }
}

export class FLWORLet implements ASTNode {
  constructor(public bindings: [ASTVariable, ASTNode][]) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitFLWORLet(this);
  }
}

export enum WindowType {
  SLIDING = 'sliding',
  TUMBLING = 'tumbling',
}
export class FLWORWindow implements ASTNode {
  constructor(
    public type: WindowType,
    public variable: ASTVariable,
    public expr: ASTNode,
    public start: WindowBoundary,
    public end?: WindowBoundary
  ) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitFLWORWindow(this);
  }
}

export class WindowBoundary {
  public expr: ASTNode;
  public only = false;

  constructor(
    public variable?: ASTVariable,
    public posVar?: ASTVariable,
    public prevVar?: ASTVariable,
    public nextVar?: ASTVariable
  ) {}
}

export class FLWORWhere implements ASTNode {
  constructor(public expr: ASTNode) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitFLWORWhere(this);
  }
}

export class FLWORGroupBy implements ASTNode {
  constructor(public bindings: [ASTVariable, ASTNode][]) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitFLWORGroupBy(this);
  }
}

export class FLWOROrderBy implements ASTNode {
  constructor(public items: OrderByItem[], public stable = false) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitFLWOROrderBy(this);
  }
}

export class OrderByItem {
  constructor(
    public expr: ASTNode,
    public ascending = false,
    public emptyGreatest = false
  ) {}
}

export class FLWORCount implements ASTNode {
  constructor(public variable: ASTVariable) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitFLWORCount(this);
  }
}

export class FLWORReturn implements ASTNode {
  constructor(public expr: ASTNode) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitFLWORReturn(this);
  }
}
