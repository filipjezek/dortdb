import { ASTNode, ASTOperator, LanguageManager } from '@dortdb/core';
import { SQLIdentifier } from '../ast/expression.js';
import { ASTTableAlias } from '../ast/alias.js';
import { JoinClause, SelectSet } from '../ast/select.js';

export interface PeggyContext {
  langMgr: LanguageManager;
  wrapNot: (expr: ASTNode, not: boolean) => ASTNode;
  makeOp: (op: string | SQLIdentifier, operands: ASTNode[]) => ASTOperator;
  allFrom: (src: SQLIdentifier | ASTTableAlias | JoinClause) => SelectSet;
  parentOp: (op: ASTNode, parent: string) => void;
  ast: Record<string, unknown>;
}
