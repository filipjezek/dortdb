import { FnCallWrapper } from '../ast/expression.js';
import {
  ASTNode,
  ASTOperator,
  LanguageManager,
  ASTIdentifier,
} from '@dortdb/core';

/** Context object threaded through the Peggy Cypher grammar to provide AST constructors and language services. */
export interface PeggyContext {
  /** The language manager, used to resolve cross-language identifiers during parsing. */
  langMgr: LanguageManager;
  /** Constructs an {@link ASTOperator} from an operator symbol (string or identifier) and its operands. */
  makeOp: (op: string | ASTIdentifier, operands: ASTNode[]) => ASTOperator;
  /** Wraps an {@link ASTFunction} in a {@link FnCallWrapper} that carries the optional `DISTINCT` flag. */
  wrapFn: (
    id: ASTIdentifier,
    args?: ASTNode[],
    distinct?: boolean,
  ) => FnCallWrapper;
  /** Namespace of AST constructor classes exposed directly to grammar actions. */
  ast: Record<string, unknown>;
}
