import { ASTNode } from '@dortdb/core';
import { SQLVisitor } from './visitor';

export class SelectStatement implements ASTNode {
  accept(visitor: SQLVisitor): void {
    visitor.visitSelectStatement(this);
  }
}
