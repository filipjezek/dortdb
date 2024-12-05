import { ASTNode, ASTIdentifier } from '@dortdb/core';
import { SQLVisitor } from './visitor.js';
import { parseIdentifier } from '../utils/string.js';

export class ASTTableAlias implements ASTNode {
  name: string;
  columns: string[];
  table: ASTIdentifier;

  constructor(public nameOriginal: string, public columnsOriginal?: string[]) {
    this.name = parseIdentifier(nameOriginal);
    this.columns = columnsOriginal?.map(parseIdentifier);
  }

  accept<T>(visitor: SQLVisitor<T>) {
    return visitor.visitTableAlias(this);
  }
}

export class ASTExpressionAlias implements ASTNode {
  public alias: string;

  constructor(public expression: ASTNode, public aliasOriginal: string) {
    this.alias = parseIdentifier(aliasOriginal);
  }

  accept<T>(visitor: SQLVisitor<T>) {
    return visitor.visitExpressionAlias(this);
  }
}
