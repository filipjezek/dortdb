import {
  ASTNode,
  ASTOperator,
  LanguageManager,
  ASTIdentifier,
} from '@dortdb/core';

/**
 * Context object threaded through the Peggy grammar during XQuery parsing,
 * providing the language manager, AST factories, and string utility functions.
 */
export interface PeggyContext {
  /** The language manager for resolving operator and identifier registrations. */
  langMgr: LanguageManager;
  /** Creates an {@link ASTOperator} node for the given operator name or identifier and operands. */
  makeOp: (op: string | ASTIdentifier, operands: ASTNode[]) => ASTOperator;
  /** Map of AST constructor references and shared constants used within grammar actions. */
  ast: Record<string, unknown>;
  /** Decodes a single XML character-reference or predefined entity escape sequence. */
  interpretEscape: (esc: string) => string;
}
