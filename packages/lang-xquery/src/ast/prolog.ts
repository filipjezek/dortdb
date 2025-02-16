import { ASTNode } from '@dortdb/core';
import { XQueryIdentifier, ASTStringLiteral } from './expression.js';
import { XQueryVisitor } from './visitor.js';

export class Prolog implements ASTNode {
  constructor(public declarations: Declaration[]) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitProlog(this, arg);
  }
}

export type Declaration =
  | NSDeclaration
  | BaseURIDeclaration
  | OrderingDeclaration
  | EmptyOrderDeclaration;

export class NSDeclaration {
  constructor(
    public prefix: XQueryIdentifier,
    public uri: ASTStringLiteral,
  ) {}
}

export class DefaultNSDeclaration implements ASTNode {
  constructor(
    public uri: ASTStringLiteral,
    public type: 'element' | 'function',
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitDefaultNSDeclaration(this, arg);
  }
}

export class BaseURIDeclaration implements ASTNode {
  constructor(public uri: ASTStringLiteral) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitBaseURIDeclaration(this, arg);
  }
}

export enum OrderingMode {
  ORDERED = 'ordered',
  UNORDERED = 'unordered',
}
export class OrderingDeclaration implements ASTNode {
  constructor(public mode: OrderingMode) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitOrderingDeclaration(this, arg);
  }
}

export class EmptyOrderDeclaration implements ASTNode {
  constructor(public emptyGreatest = false) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitEmptyOrderDeclaration(this, arg);
  }
}

export class Module implements ASTNode {
  constructor(
    public prolog: Prolog,
    public body: ASTNode[],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitModule(this, arg);
  }
}
