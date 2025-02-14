import {
  ASTFunction,
  ASTOperator,
  Language,
  LanguageManager,
} from '@dortdb/core';
import {
  cypherLexer as Lexer,
  cypherParser as Parser,
} from './parser/cypher.cjs';
import { Keywords, AdditionalTokens } from './parser/tokens.js';
import { YyContext } from './parser/yycontext.js';
import * as ast from './ast/index.js';
import { ASTLiteral } from '@dortdb/core';

export const Cypher: Language<'cypher'> = {
  name: 'cypher',
  operators: [],
  aggregates: [],
  functions: [],
  castables: [],
  visitors: {
    logicalPlanBuilder: null,
  },
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
    langMgr: mgr,

    messageQueue: [],
    saveRemainingInput: (input) => (remainingInput = input),
    makeOp: (op, args) =>
      typeof op === 'string'
        ? new ASTOperator(
            'cypher',
            new ast.CypherIdentifier(op.toLowerCase()),
            args
          )
        : new ASTOperator('cypher', op, args),
    wrapFn: (id, args = [], distinct = false) =>
      new ast.FnCallWrapper(new ASTFunction('cypher', id, args), distinct),
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
