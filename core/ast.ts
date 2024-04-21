export interface ASTNode {
  accept(visitor: ASTVisitor): void;
}

export interface ASTLiteral<T> extends ASTNode {
  original: string;
  value: T;
}

export interface ASTVisitor {}
