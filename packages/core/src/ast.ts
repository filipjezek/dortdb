export interface ASTNode {
  accept<T>(visitor: ASTVisitor<T>): T;
}

export class ASTLiteral<T> implements ASTNode {
  constructor(public original: string, public value: T) {}

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.acceptLiteral(this);
  }
}

export class ASTOperator implements ASTNode {
  constructor(
    public lang: string,
    public id: ASTIdentifier,
    public operands: ASTNode[]
  ) {}

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.acceptOperator(this);
  }
}

export class ASTFunction implements ASTNode {
  constructor(
    public lang: string,
    public id: ASTIdentifier,
    public args: ASTNode[]
  ) {}

  accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.acceptFunction(this);
  }
}

export interface ASTIdentifier extends ASTNode {
  schema?: string;
  id: string;
}

export interface ASTVisitor<T> {
  acceptLiteral<U>(literal: ASTLiteral<U>): T;
  acceptOperator(op: ASTOperator): T;
  acceptFunction(fn: ASTFunction): T;
}
