import { FnCallWrapper } from '../ast/expression.js';
import {
  ASTNode,
  ASTOperator,
  LanguageManager,
  ASTIdentifier,
} from '@dortdb/core';

export interface PeggyContext {
  langMgr: LanguageManager;
  makeOp: (op: string | ASTIdentifier, operands: ASTNode[]) => ASTOperator;
  wrapFn: (
    id: ASTIdentifier,
    args?: ASTNode[],
    distinct?: boolean,
  ) => FnCallWrapper;
  ast: Record<string, unknown>;
}
