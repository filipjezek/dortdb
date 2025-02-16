import { ASTNode } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { ASTVariable } from './expression.js';

export class InlineFunction implements ASTNode {
  constructor(
    public args: ASTVariable[],
    public body: ASTNode[],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitInlineFn(this, arg);
  }
}

export class DynamicFunctionCall implements ASTNode {
  constructor(
    public nameOrExpr: ASTNode,
    public args: ASTNode[] = [],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitDynamicFunctionCall(this, arg);
  }
}

export class BoundFunction implements ASTNode {
  constructor(
    public nameOrExpr: ASTNode,
    public boundArgs: [number, ASTNode][],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitBoundFunction(this, arg);
  }
}
