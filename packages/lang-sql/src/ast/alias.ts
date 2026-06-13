import { ASTNode, ASTIdentifier } from '@dortdb/core';
import { SQLVisitor } from './visitor.js';
import { parseIdentifier } from '../utils/string.js';

/**
 * SQL table alias, mapping a source relation to a new name and optional column list.
 */
export class ASTTableAlias implements ASTNode {
  /** Normalized (lower-cased) alias name. */
  name: string;
  /** Normalized column names; `undefined` when no column aliases were specified. */
  columns: string[];
  /** The aliased relation node, set by the planner after parsing. */
  table: ASTNode;

  constructor(
    /** The alias name as it appears in the SQL source, before identifier normalization. */
    public nameOriginal: string,
    /** Column rename list as written in SQL; `undefined` when no column aliases were specified. */
    public columnsOriginal?: string[],
  ) {
    this.name = parseIdentifier(nameOriginal);
    this.columns = columnsOriginal?.map(parseIdentifier);
  }

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg) {
    return visitor.visitTableAlias(this, arg);
  }
}

/**
 * Wraps an expression with a user-defined alias (the `AS name` clause).
 */
export class ASTExpressionAlias implements ASTNode {
  /** Normalized alias name. */
  public alias: string;

  constructor(
    /** The aliased expression. */
    public expression: ASTNode,
    /** The alias as written in SQL source, before normalization. */
    public aliasOriginal: string,
  ) {
    this.alias = parseIdentifier(aliasOriginal);
  }

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg) {
    return visitor.visitExpressionAlias(this, arg);
  }
}
