import { AggregateCall } from './plan/operators/index.js';

export interface ASTNode {
  accept<Ret, Arg>(visitor: ASTVisitor<Ret, Arg>, arg?: Arg): Ret;
}

export class ASTLiteral<T> implements ASTNode {
  constructor(
    public original: string,
    public value: T,
  ) {}

  accept<Ret, Arg>(visitor: ASTVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitLiteral(this, arg);
  }
}

export class ASTOperator implements ASTNode {
  constructor(
    public lang: Lowercase<string>,
    public id: ASTIdentifier,
    public operands: ASTNode[],
  ) {}

  accept<Ret, Arg>(visitor: ASTVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitOperator(this, arg);
  }
}

export class ASTFunction implements ASTNode {
  constructor(
    public lang: Lowercase<string>,
    public id: ASTIdentifier,
    public args: ASTNode[],
  ) {}

  accept<Ret, Arg>(visitor: ASTVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFunction(this, arg);
  }
}

export const allAttrs = Symbol('all attrs');
export const boundParam = Symbol('bound param');

export class ASTIdentifier implements ASTNode {
  public aggregate?: AggregateCall;

  public parts: (string | symbol | number)[] = [];
  [Symbol.iterator]() {
    return this.parts[Symbol.iterator]();
  }

  accept<Ret, Arg>(visitor: ASTVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitIdentifier(this, arg);
  }

  static fromParts(parts: (string | symbol | number)[]): ASTIdentifier {
    const ret = new ASTIdentifier();
    ret.parts = parts;
    return ret;
  }

  public equals(other: ASTIdentifier): boolean {
    if (this.parts.length !== other.parts.length) return false;
    for (let i = 0; i < this.parts.length; i++) {
      if (this.parts[i] !== other.parts[i]) return false;
    }
    return true;
  }
}

export class LangSwitch implements ASTNode {
  public node: ASTNode;
  constructor(
    public lang: Lowercase<string>,
    nodes: ASTNode[],
  ) {
    if (nodes.length !== 1)
      throw new Error('LangSwitch must contain exactly one statement');
    this.node = nodes[0];
  }

  accept<Ret, Arg>(visitor: ASTVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitLangSwitch(this, arg);
  }
}

export interface ASTVisitor<Ret, Arg = never> {
  visitLiteral<T>(node: ASTLiteral<T>, arg?: Arg): Ret;
  visitOperator(node: ASTOperator, arg?: Arg): Ret;
  visitFunction(node: ASTFunction, arg?: Arg): Ret;
  visitLangSwitch(node: LangSwitch, arg?: Arg): Ret;
  visitIdentifier(node: ASTIdentifier, arg?: Arg): Ret;
}
