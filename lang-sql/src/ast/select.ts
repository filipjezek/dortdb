import { ASTNode } from '@dortdb/core';
import { SQLVisitor } from './visitor.js';

export class SelectStatement implements ASTNode {
  accept(visitor: SQLVisitor): void {
    visitor.visitSelectStatement(this);
  }
}
