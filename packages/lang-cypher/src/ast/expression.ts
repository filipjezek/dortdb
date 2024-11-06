import { ASTFunction, ASTNode } from '@dortdb/core';
import { ASTIdentifier } from './literal.js';
import { CypherVisitor } from './visitor.js';

export class FnCallWrapper implements ASTNode {
  constructor(public fn: ASTFunction, public distinct: boolean) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitFnCallWrapper(this);
  }
}
