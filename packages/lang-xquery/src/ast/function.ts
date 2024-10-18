import { ASTNode } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { ASTVariable } from './expression.js';

export class InlineFunction implements ASTNode {
  constructor(public args: ASTVariable[], public body: ASTNode[]) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitInlineFn(this);
  }
}

export class DynamicFunctionCall implements ASTNode {
  constructor(public nameOrExpr: ASTNode, public args: ASTNode[] = []) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitDynamicFunctionCall(this);
  }
}

export class BoundFunction implements ASTNode {
  constructor(
    public nameOrExpr: ASTNode,
    public boundArgs: [number, ASTNode][]
  ) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitBoundFunction(this);
  }
}
