import { LanguageManager } from './lang-manager.js';

export interface ASTNode {
  accept<T>(visitor: ASTVisitor<T>): T;
}

export class ASTLiteral<T> implements ASTNode {
  constructor(public original: string, public value: T) {}

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitLiteral(this);
  }
}

export class ASTOperator implements ASTNode {
  constructor(
    public lang: string,
    public id: ASTIdentifier,
    public operands: ASTNode[]
  ) {}

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitOperator(this);
  }
}

export class ASTFunction implements ASTNode {
  constructor(
    public lang: string,
    public id: ASTIdentifier,
    public args: ASTNode[]
  ) {}

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitFunction(this);
  }
}

export const allAttrs = Symbol('all attrs');
export class ASTIdentifier implements ASTNode {
  public parts: (string | symbol)[] = [];

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitIdentifier(this);
  }

  static fromParts(parts: (string | symbol)[]): ASTIdentifier {
    const ret = new ASTIdentifier();
    ret.parts = parts;
    return ret;
  }
}

export class LangSwitch implements ASTNode {
  constructor(public lang: string, public node: ASTNode) {}

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitLangSwitch(this);
  }
}

export interface ASTVisitor<T> {
  visitLiteral<U>(node: ASTLiteral<U>): T;
  visitOperator(node: ASTOperator): T;
  visitFunction(node: ASTFunction): T;
  visitLangSwitch(node: LangSwitch): T;
  visitIdentifier(node: ASTIdentifier): T;
}
