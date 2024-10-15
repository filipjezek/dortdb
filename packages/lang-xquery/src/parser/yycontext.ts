import { AdditionalTokens, Keywords } from './tokens.js';
import { ASTNode, ASTOperator, LanguageManager } from '@dortdb/core';

export interface YyContext {
  Keywords: typeof Keywords;
  AdditionalTokens: typeof AdditionalTokens;
  reportComment: (comment: string) => void;
  langMgr: LanguageManager;

  comment: string;
  commentDepth: number;
  textContent: string;
  stringDelim: '"' | "'";

  /**
   * this implementation of lexer can only pass to the parser strings or numbers.
   * This way we can pass some other values
   */
  messageQueue: any[];
  saveRemainingInput: (input: string) => void;
  makeOp: (op: string, args: ASTNode[]) => ASTOperator;
  resetText: () => string;
  ast: Record<string, any>;
}
