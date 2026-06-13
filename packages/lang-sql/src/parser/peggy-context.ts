import { ASTNode, ASTOperator, LanguageManager } from '@dortdb/core';
import { SQLIdentifier } from '../ast/expression.js';
import { ASTTableAlias } from '../ast/alias.js';
import { JoinClause, SelectSet } from '../ast/select.js';

/** Context object threaded through the Peggy grammar, providing helpers and AST constructors during parsing. */
export interface PeggyContext {
  /** Language manager used to resolve cross-language references during parsing. */
  langMgr: LanguageManager;
  /** Wraps `expr` in a SQL `NOT` operator when `not` is `true`; returns `expr` unchanged otherwise. */
  wrapNot: (expr: ASTNode, not: boolean) => ASTNode;
  /** Creates an {@link ASTOperator} for the given SQL operator name or identifier and its operands. */
  makeOp: (op: string | SQLIdentifier, operands: ASTNode[]) => ASTOperator;
  /** Creates a `SELECT *` {@link SelectSet} from the given source. */
  allFrom: (src: SQLIdentifier | ASTTableAlias | JoinClause) => SelectSet;
  /** Attaches `parent` as the parent operator name on `op` if it is an `ASTQuantifier`. */
  parentOp: (op: ASTNode, parent: string) => void;
  /** Map of AST constructors and constants exposed to the Peggy grammar actions. */
  ast: Record<string, unknown>;
}
