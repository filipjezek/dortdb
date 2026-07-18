import { ASTNode } from '@dortdb/core';
import { XQueryIdentifier, ASTStringLiteral } from './expression.js';
import { XQueryVisitor } from './visitor.js';

/** XQuery module prolog holding the ordered list of environment declarations. */
export class Prolog implements ASTNode {
  constructor(
    /** The declarations in source order. */
    public declarations: Declaration[],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitProlog(this, arg);
  }
}

/** Union of all prolog declaration node types that may appear in a {@link Prolog}. */
export type Declaration =
  | NSDeclaration
  | BaseURIDeclaration
  | OrderingDeclaration
  | EmptyOrderDeclaration;

/** XQuery `declare namespace prefix = "uri"` declaration binding a prefix to a namespace URI. */
export class NSDeclaration implements ASTNode {
  constructor(
    /** The namespace prefix being declared. */
    public prefix: string,
    /** The namespace URI bound to the prefix. */
    public uri: ASTStringLiteral,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitNSDeclaration(this, arg);
  }
}

/** XQuery `declare default element/function namespace "uri"` declaration. */
export class DefaultNSDeclaration implements ASTNode {
  constructor(
    /** The namespace URI to use as the default. */
    public uri: ASTStringLiteral,
    /** Whether this sets the default `element` or `function` namespace. */
    public type: 'element' | 'function',
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitDefaultNSDeclaration(this, arg);
  }
}

/** XQuery `declare base-uri "uri"` declaration setting the static base URI. */
export class BaseURIDeclaration implements ASTNode {
  constructor(
    /** The base URI string literal. */
    public uri: ASTStringLiteral,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitBaseURIDeclaration(this, arg);
  }
}

/** Whether a query or expression context uses ordered or unordered node-sequence semantics. */
export enum OrderingMode {
  /** Node sequences are returned in document order. */
  ORDERED = 'ordered',
  /** Node sequences may be returned in any order. */
  UNORDERED = 'unordered',
}

/** XQuery `declare ordering ordered/unordered` declaration. */
export class OrderingDeclaration implements ASTNode {
  constructor(
    /** The chosen ordering mode for the module. */
    public mode: OrderingMode,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitOrderingDeclaration(this, arg);
  }
}

/** XQuery `declare default order empty greatest/least` declaration controlling where empty sequences sort. */
export class EmptyOrderDeclaration implements ASTNode {
  constructor(
    /** `true` if empty sequences sort after all other values (`empty greatest`), `false` for `empty least`. */
    public emptyGreatest = false,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitEmptyOrderDeclaration(this, arg);
  }
}

/** Top-level XQuery module consisting of a prolog and a sequence of body expressions. */
export class Module implements ASTNode {
  constructor(
    /** The module prolog containing namespace and environment declarations. */
    public prolog: Prolog,
    /** The main-module body expressions evaluated to produce the module's result. */
    public body: ASTNode[],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitModule(this, arg);
  }
}
