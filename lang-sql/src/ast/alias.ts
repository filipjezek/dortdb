import { ASTNode } from '@dortdb/core';
import { SQLVisitor } from './visitor.js';
import { parseIdentifier } from '../utils/string.js';
import { ASTIdentifier } from './expression.js';

export class ASTTableAlias implements ASTNode {
  name: string;
  columns: string[];

  constructor(public nameOriginal: string, public columnsOriginal?: string[]) {
    this.name = parseIdentifier(nameOriginal);
    this.columns = columnsOriginal?.map(parseIdentifier);
  }

  accept(visitor: SQLVisitor) {
    return visitor.visitTableAlias(this);
  }
}

export class ASTFieldSelector implements ASTNode {
  public field: string;

  constructor(public fieldOriginal: string, public table?: ASTIdentifier) {
    this.field = parseIdentifier(fieldOriginal);
  }

  accept(visitor: SQLVisitor) {
    return visitor.visitFieldSelector(this);
  }
}
