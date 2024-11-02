import {
  ASTFunction,
  ASTOperator,
  Language,
  LanguageManager,
} from '@dortdb/core';
import { sqlLexer as Lexer, sqlParser as Parser } from './parser/cypher.cjs';
import { Keywords, AdditionalTokens } from './parser/tokens.js';
import { YyContext } from './parser/yycontext.js';
import * as ast from './ast/index.js';
import { ASTLiteral } from '@dortdb/core';

export const Cypher: Language<'cypher'> = {
  name: 'cypher',
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
    strContent: '',
    delimiter: '',
    langMgr: mgr,

    messageQueue: [],
    saveRemainingInput: (input) => (remainingInput = input),
    wrapNot: (expr, not) =>
      not
        ? new ASTOperator('cypher', new ast.ASTIdentifier('NOT'), [expr])
        : expr,
    makeOp: (op, args) =>
      typeof op === 'string'
        ? new ASTOperator('cypher', new ast.ASTIdentifier(op), args)
        : new ASTOperator('cypher', op, args),
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
