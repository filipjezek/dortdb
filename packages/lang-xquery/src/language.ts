import {
  ASTFunction,
  ASTOperator,
  Language,
  LanguageManager,
} from '@dortdb/core';
import { sqlLexer as Lexer, sqlParser as Parser } from './parser/xquery.cjs';
import { Keywords, AdditionalTokens } from './parser/tokens.js';
import { YyContext } from './parser/yycontext.js';
import * as ast from './ast/index.js';
import { ASTLiteral } from '@dortdb/core';

export const SQL: Language<'xquery'> = {
  name: 'xquery',
  operators: [],
  aggregates: [],
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
    textContent: '',
    langMgr: mgr,

    messageQueue: [],
    saveRemainingInput: (input) => (remainingInput = input),
    ast: {
      ...ast,
      ASTLiteral,
      ASTOperator,
      ASTFunction,
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
