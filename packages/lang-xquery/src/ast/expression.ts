import { ASTLiteral, ASTNode, ASTIdentifier } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { parseName, parseStringLiteral } from '../utils/string.js';
import { ASTItemType } from './item-type.js';

export class ASTStringLiteral extends ASTLiteral<string> {
  constructor(public original: string) {
    super(original, null);
    this.value = parseStringLiteral(original);
  }

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitStringLiteral(this);
  }
}

export class ASTNumberLiteral extends ASTLiteral<number> {
  constructor(public original: string) {
    super(original, +original);
  }

  override accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitNumberLiteral(this);
  }
}

export class ASTName implements ASTIdentifier {
  public schema: string;
  public id: string;

  constructor(public original: string) {
    if (!original) return;
    [this.schema, this.id] = parseName(original);
  }

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitName(this);
  }

  equals(other: ASTName) {
    return this.schema === other.schema && this.id === other.id;
  }
}

export class ASTVariable extends ASTName {
  constructor(name: ASTName) {
    super(null);
    this.schema = name.schema;
    this.id = name.id;
    this.original = name.original;
  }

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitVariable(this);
  }
}

export enum Quantifier {
  EVERY = 'every',
  SOME = 'some',
}
export class QuantifiedExpr implements ASTNode {
  constructor(
    public quantifier: string,
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
  constructor(public expr: ASTNode, public type: ASTName) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitCastExpr(this);
  }
}

export class FilterExpr implements ASTNode {
  constructor(public expr: ASTNode, public predicate: ASTNode) {}

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
