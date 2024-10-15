import { ASTNode } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { ASTName } from './expression.js';

export class DirectElementConstructor implements ASTNode {
  constructor(
    public name: string,
    public attributes: [ASTName, DirConstrContent][],
    public children: ASTNode[] = []
  ) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitDirectElementConstructor(this);
  }
}

export class DirConstrContent implements ASTNode {
  constructor(public content: (ASTNode | string)[]) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitDirConstrContent(this);
  }
}
