import { FnCallWrapper } from '../ast/expression.js';
import { AdditionalTokens, Keywords } from './tokens.js';
import {
  ASTNode,
  ASTOperator,
  LanguageManager,
  ASTIdentifier,
} from '@dortdb/core';

export interface YyContext {
  Keywords: typeof Keywords;
  AdditionalTokens: typeof AdditionalTokens;
  reportComment: (comment: string) => void;
  langMgr: LanguageManager;

  comment: string;
  commentDepth: number;

  /**
   * this implementation of lexer can only pass to the parser strings or numbers.
   * This way we can pass some other values
   */
  messageQueue: any[];
  saveRemainingInput: (input: string) => void;
  makeOp: (op: string | ASTIdentifier, operands: ASTNode[]) => ASTOperator;
  wrapFn: (
    id: ASTIdentifier,
    args?: ASTNode[],
    distinct?: boolean
  ) => FnCallWrapper;
  ast: Record<string, any>;
}
