import {
  ASTNode,
  ASTOperator,
  LanguageManager,
  ASTIdentifier,
} from '@dortdb/core';

export interface PeggyContext {
  langMgr: LanguageManager;
  makeOp: (op: string | ASTIdentifier, operands: ASTNode[]) => ASTOperator;
  ast: Record<string, unknown>;
  interpretEscape: (esc: string) => string;
}
