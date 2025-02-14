import { ASTLiteral, ASTNode, ASTIdentifier } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { parseName, parseStringLiteral } from '../utils/string.js';
import { ASTItemType } from './item-type.js';
import { PathPredicate } from './path.js';

export class ASTStringLiteral extends ASTLiteral<string> {
  constructor(original: string) {
    super(original, null);
    this.value = parseStringLiteral(original);
  }

  override accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitStringLiteral(this);
  }
}

export class ASTNumberLiteral extends ASTLiteral<number> {
  constructor(original: string) {
    super(original, +original);
  }

  override accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitNumberLiteral(this);
  }
}

export class XQueryIdentifier extends ASTIdentifier {
  constructor(public original: string) {
    super();
    if (!original) return;
    this.parts = parseName(original);
  }

  override accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitXQueryIdentifier(this);
  }
}

export class ASTVariable extends XQueryIdentifier {
  constructor(name: XQueryIdentifier) {
    super(null);
    this.parts = name.parts;
  }

  override accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitVariable(this);
  }
}

export enum Quantifier {
  EVERY = 'every',
  SOME = 'some',
}
export class QuantifiedExpr implements ASTNode {
  constructor(
    public quantifier: Quantifier,
    public variables: [ASTVariable, ASTNode][],
    public expr: ASTNode
  ) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitQuantifiedExpr(this);
  }
}

export class SwitchExpr implements ASTNode {
  constructor(
    public expr: ASTNode,
    public cases: [ASTNode[], ASTNode][],
    public defaultCase: ASTNode
  ) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitSwitchExpr(this);
  }
}

export class IfExpr implements ASTNode {
  constructor(
    public condition: ASTNode,
    public then: ASTNode,
    public elseExpr: ASTNode
  ) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitIfExpr(this);
  }
}

export enum Occurence {
  ZERO_OR_ONE = '?',
  ZERO_OR_MORE = '*',
  ONE_OR_MORE = '+',
}
export class ASTSequenceType implements ASTNode {
  constructor(public type?: ASTItemType, public occurrence?: string) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitSequenceType(this);
  }
}

export class InstanceOfExpr implements ASTNode {
  constructor(public expr: ASTNode, public type: ASTSequenceType) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitInstanceOfExpr(this);
  }
}

export class CastExpr implements ASTNode {
  constructor(public expr: ASTNode, public type: XQueryIdentifier) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitCastExpr(this);
  }
}

export class FilterExpr implements ASTNode {
  constructor(public expr: ASTNode, public predicate: PathPredicate) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitFilterExpr(this);
  }
}

export class SequenceConstructor implements ASTNode {
  constructor(public items: ASTNode[]) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitSequenceConstructor(this);
  }
}

export class OrderedExpr implements ASTNode {
  constructor(public exprs: ASTNode[], public ordered: boolean) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitOrderedExpr(this);
  }
}
