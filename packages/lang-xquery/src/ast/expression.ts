import { ASTLiteral, ASTNode, ASTFunction, ASTIdentifier } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { parseName, parseStringLiteral } from '../utils/string.js';

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
