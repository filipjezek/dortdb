import { ASTNode } from '@dortdb/core';
import { ASTName, ASTStringLiteral } from './expression.js';
import { XQueryVisitor } from './visitor.js';

export class Prolog implements ASTNode {
  constructor(public declarations: Declaration[]) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitProlog(this);
  }
}

export type Declaration =
  | NSDeclaration
  | BaseURIDeclaration
  | OrderingDeclaration
  | EmptyOrderDeclaration;

export class NSDeclaration {
  constructor(public prefix: ASTName, public uri: ASTStringLiteral) {}
}

export class DefaultNSDeclaration implements ASTNode {
  constructor(
    public uri: ASTStringLiteral,
    public type: 'element' | 'function'
  ) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitDefaultNSDeclaration(this);
  }
}

export class BaseURIDeclaration implements ASTNode {
  constructor(public uri: ASTStringLiteral) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitBaseURIDeclaration(this);
  }
}

export enum OrderingMode {
  ORDERED = 'ordered',
  UNORDERED = 'unordered',
}
export class OrderingDeclaration implements ASTNode {
  constructor(public mode: OrderingMode) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitOrderingDeclaration(this);
  }
}

export class EmptyOrderDeclaration implements ASTNode {
  constructor(public emptyGreatest = false) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitEmptyOrderDeclaration(this);
  }
}
