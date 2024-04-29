import {
  ASTFunction,
  ASTOperator,
  Language,
  LanguageManager,
  ASTAggregator,
} from '@dortdb/core';
import { sqlLexer as Lexer, sqlParser as Parser } from './sql.js';
import { Keywords, AdditionalTokens } from './tokens.js';
import { YyContext } from './yycontext.js';
import * as ast from '../ast/index.js';
import { ASTLiteral } from '@dortdb/core';

export const SQL: Language<'sql'> = {
  name: 'sql',
  operators: [],
  aggregators: [],
  functions: [],
  createParser,
};

function createParser(mgr: LanguageManager) {
  let remainingInput = '';
  const yy: YyContext = {
    Keywords,
    AdditionalTokens,
    reportComment: () => {},
    commentDepth: 0,
    comment: '',
    strContent: '',
    delimiter: '',
    langMgr: mgr,

    messageQueue: [],
    saveRemainingInput: (input) => (remainingInput = input),
    wrapNot: (expr, not) =>
      not ? new ASTOperator('sql', new ast.ASTIdentifier('NOT'), [expr]) : expr,
    makeOp: (op, args) =>
      typeof op === 'string'
        ? new ASTOperator('sql', new ast.ASTIdentifier(op), args)
        : new ASTOperator('sql', op, args),
    ast: {
      ...ast,
      ASTLiteral,
      ASTOperator,
      ASTFunction,
      ASTAggregator,
    },
  };

  const parser = new Parser(yy, new Lexer(yy));
  return {
    parse: (input: string) => {
      const result = parser.parse(input);
      return {
        value: result,
        remainingInput,
      };
    },
  };
}
