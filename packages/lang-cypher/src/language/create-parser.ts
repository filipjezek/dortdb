import {
  ASTFunction,
  ASTLiteral,
  ASTOperator,
  LanguageManager,
} from '@dortdb/core';
import { AdditionalTokens, Keywords } from 'src/parser/tokens.js';
import { YyContext } from 'src/parser/yycontext.js';
import * as ast from 'src/ast/index.js';
import {
  cypherParser as Parser,
  cypherLexer as Lexer,
} from '../parser/cypher.cjs';

export function createParser(mgr: LanguageManager) {
  let remainingInput = '';
  const yy: YyContext = {
    Keywords,
    AdditionalTokens,
    reportComment: () => {},
    commentDepth: 0,
    comment: '',
    langMgr: mgr,

    messageQueue: [],
    saveRemainingInput: (input) => {
      if (remainingInput.slice(0, -input.length).match(/^\s*[)}\]]\s*$/)) {
        return;
      }
      remainingInput = input;
    },
    makeOp: (op, args) =>
      typeof op === 'string'
        ? new ASTOperator(
            'cypher',
            new ast.CypherIdentifier(op.toLowerCase()),
            args,
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
