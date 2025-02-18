import { AdditionalTokens, Keywords } from './tokens.js';
import { ASTNode, ASTOperator, LanguageManager } from '@dortdb/core';
import {
  ASTTableAlias,
  JoinClause,
  SQLIdentifier,
  SelectSet,
} from '../ast/index.js';

export interface YyContext {
  Keywords: typeof Keywords;
  AdditionalTokens: typeof AdditionalTokens;
  reportComment: (comment: string) => void;
  langMgr: LanguageManager;

  comment: string;
  commentDepth: number;
  delimiter: string;
  strContent: string;

  /**
   * this implementation of lexer can only pass to the parser strings or numbers.
   * This way we can pass some other values
   */
  messageQueue: unknown[];
  saveRemainingInput: (input: string) => void;
  wrapNot: (expr: ASTNode, not: boolean) => ASTNode;
  makeOp: (op: string | SQLIdentifier, operands: ASTNode[]) => ASTOperator;
  allFrom: (src: SQLIdentifier | ASTTableAlias | JoinClause) => SelectSet;
  parentOp: (op: ASTNode, parent: string) => void;
  ast: Record<string, unknown>;
}
