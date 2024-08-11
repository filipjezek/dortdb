export interface ASTNode {
  accept(visitor: ASTVisitor): void;
}

export class ASTLiteral<T> implements ASTNode {
  constructor(public original: string, public value: T) {}

  accept(visitor: ASTVisitor): void {
    visitor.acceptLiteral(this);
  }
}

export class ASTOperator implements ASTNode {
  constructor(
    public lang: string,
    public id: ASTIdentifier,
    public operands: ASTNode[]
  ) {}

  accept(visitor: ASTVisitor): void {
    visitor.acceptOperator(this);
  }
}

export class ASTFunction implements ASTNode {
  constructor(
    public lang: string,
    public id: ASTIdentifier,
    public args: ASTNode[]
  ) {}

  accept(visitor: ASTVisitor): void {
    visitor.acceptFunction(this);
  }
}

export interface ASTIdentifier extends ASTNode {
  schema?: string;
  id: string;
}

export interface ASTVisitor {
  acceptLiteral<T>(literal: ASTLiteral<T>): void;
  acceptOperator(op: ASTOperator): void;
  acceptFunction(fn: ASTFunction): void;
}
