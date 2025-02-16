import { ASTNode, ASTIdentifier } from '@dortdb/core';
import { SQLVisitor } from './visitor.js';
import { parseIdentifier } from '../utils/string.js';

export class ASTTableAlias implements ASTNode {
  name: string;
  columns: string[];
  table: ASTNode;

  constructor(
    public nameOriginal: string,
    public columnsOriginal?: string[],
  ) {
    this.name = parseIdentifier(nameOriginal);
    this.columns = columnsOriginal?.map(parseIdentifier);
  }

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg) {
    return visitor.visitTableAlias(this, arg);
  }
}

export class ASTExpressionAlias implements ASTNode {
  public alias: string;

  constructor(
    public expression: ASTNode,
    public aliasOriginal: string,
  ) {
    this.alias = parseIdentifier(aliasOriginal);
  }

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg) {
    return visitor.visitExpressionAlias(this, arg);
  }
}
