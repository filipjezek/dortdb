import { ASTNode } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { ASTVariable } from './expression.js';

export class FLWORExpr implements ASTNode {
  constructor(public clauses: FLWORClause[]) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORExpr(this, arg);
  }
}

export type FLWORClause = FLWORFor | FLWORLet | FLWORWindow;

export class FLWORFor implements ASTNode {
  constructor(public bindings: FLWORForBinding[]) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORFor(this, arg);
  }
}

export class FLWORForBinding implements ASTNode {
  constructor(
    public variable: ASTVariable,
    public expr: ASTNode,
    public allowEmpty = false,
    public posVar?: ASTVariable,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORForBinding(this, arg);
  }
}

export class FLWORLet implements ASTNode {
  constructor(public bindings: [ASTVariable, ASTNode][]) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORLet(this, arg);
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
    public end?: WindowBoundary,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORWindow(this, arg);
  }
}

export class WindowBoundary {
  public expr: ASTNode;
  public only = false;

  constructor(
    public variable?: ASTVariable,
    public posVar?: ASTVariable,
    public prevVar?: ASTVariable,
    public nextVar?: ASTVariable,
  ) {}
}

export class FLWORWhere implements ASTNode {
  constructor(public expr: ASTNode) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORWhere(this, arg);
  }
}

export class FLWORGroupBy implements ASTNode {
  constructor(public bindings: [ASTVariable, ASTNode][]) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORGroupBy(this, arg);
  }
}

export class FLWOROrderBy implements ASTNode {
  constructor(
    public items: OrderByItem[],
    public stable = false,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWOROrderBy(this, arg);
  }
}

export class OrderByItem {
  constructor(
    public expr: ASTNode,
    public ascending = false,
    public emptyGreatest = false,
  ) {}
}

export class FLWORCount implements ASTNode {
  constructor(public variable: ASTVariable) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORCount(this, arg);
  }
}

export class FLWORReturn implements ASTNode {
  constructor(public expr: ASTNode) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORReturn(this, arg);
  }
}
