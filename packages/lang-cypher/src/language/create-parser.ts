import {
  allAttrs,
  ASTFunction,
  ASTIdentifier,
  ASTLiteral,
  ASTNode,
  ASTOperator,
  boundParam,
  LangSwitch,
  LanguageManager,
} from '@dortdb/core';
import { AdditionalTokens, Keywords } from '../parser/tokens.js';
import { YyContext } from '../parser/yycontext.js';
import * as ast from '../ast/index.js';
import {
  cypherParser as Parser,
  cypherLexer as Lexer,
} from '../parser/cypher.cjs';

const scopeExits = new Set([')', '}', ']']);

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
      ASTIdentifier,
      LangSwitch,
      allAttrs,
      boundParam,
    },
  };

  const parser = new Parser(yy, new Lexer(yy));
  return {
    parse: (input: string) => {
      const result: {
        value: ASTNode[];
        scopeExit?: string;
        error?: string;
      } = parser.parse(input);
      let remaining = remainingInput;
      if (scopeExits.has(result.error)) remaining = result.error + remaining;
      if (result.scopeExit) remaining = result.scopeExit + remaining;
      return {
        value: result.value,
        remainingInput: remaining,
      };
    },
  };
}
