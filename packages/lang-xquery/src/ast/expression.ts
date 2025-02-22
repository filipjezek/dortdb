import { ASTLiteral, ASTNode, ASTIdentifier, boundParam } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { parseName, parseStringLiteral } from '../utils/string.js';
import { ASTItemType } from './item-type.js';
import { PathPredicate } from './path.js';

export class ASTStringLiteral extends ASTLiteral<string> {
  constructor(original: string) {
    super(original, null);
    this.value = parseStringLiteral(original);
  }

  override accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitStringLiteral(this, arg);
  }
}

export class ASTNumberLiteral extends ASTLiteral<number> {
  constructor(original: string) {
    super(original, +original);
  }

  override accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitNumberLiteral(this, arg);
  }
}

export class XQueryIdentifier extends ASTIdentifier {
  constructor(public original: string) {
    super();
    if (!original) return;
    this.parts = parseName(original);
  }

  override accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitXQueryIdentifier(this, arg);
  }
}

export class ASTVariable extends XQueryIdentifier {
  constructor(name: XQueryIdentifier) {
    super(null);
    this.parts = name.parts;
    if (this.parts.length > 1 && this.parts[0] === 'param') {
      this.parts[0] = boundParam;
    }
  }

  override accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitVariable(this, arg);
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
    public expr: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitQuantifiedExpr(this, arg);
  }
}

export class SwitchExpr implements ASTNode {
  constructor(
    public expr: ASTNode,
    public cases: [ASTNode[], ASTNode][],
    public defaultCase: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSwitchExpr(this, arg);
  }
}

export class IfExpr implements ASTNode {
  constructor(
    public condition: ASTNode,
    public then: ASTNode,
    public elseExpr: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitIfExpr(this, arg);
  }
}

export enum Occurence {
  ZERO_OR_ONE = '?',
  ZERO_OR_MORE = '*',
  ONE_OR_MORE = '+',
}
export class ASTSequenceType implements ASTNode {
  constructor(
    public type?: ASTItemType,
    public occurrence?: string,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSequenceType(this, arg);
  }
}

export class InstanceOfExpr implements ASTNode {
  constructor(
    public expr: ASTNode,
    public type: ASTSequenceType,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitInstanceOfExpr(this, arg);
  }
}

export class CastExpr implements ASTNode {
  constructor(
    public expr: ASTNode,
    public type: XQueryIdentifier,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitCastExpr(this, arg);
  }
}

export class FilterExpr implements ASTNode {
  constructor(
    public expr: ASTNode,
    public predicate: PathPredicate,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFilterExpr(this, arg);
  }
}

export class SequenceConstructor implements ASTNode {
  constructor(public items: ASTNode[]) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSequenceConstructor(this, arg);
  }
}

export class OrderedExpr implements ASTNode {
  constructor(
    public exprs: ASTNode[],
    public ordered: boolean,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitOrderedExpr(this, arg);
  }
}
