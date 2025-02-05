import {
  aggregates,
  ASTFunction,
  ASTOperator,
  LangSwitch,
  Language,
  LanguageManager,
} from '@dortdb/core';
import {
  xqueryLexer as Lexer,
  xqueryParser as Parser,
} from './parser/xquery.cjs';
import { Keywords, AdditionalTokens } from './parser/tokens.js';
import { YyContext } from './parser/yycontext.js';
import * as ast from './ast/index.js';
import { ASTLiteral } from '@dortdb/core';
import { XQueryLogicalPlanBuilder } from './visitors/builder.js';
import { DOT } from './utils/dot.js';
import { castables } from './castables/index.js';

export const XQuery: Language<'xquery'> = {
  name: 'xquery',
  operators: [],
  aggregates: [{ ...aggregates.count, schema: 'fn' }],
  functions: [],
  castables,
  createParser,
  visitors: {
    logicalPlanBuilder: XQueryLogicalPlanBuilder,
  },
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
    stringDelim: undefined,
    elStack: [],

    messageQueue: [],
    saveRemainingInput: (input) => (remainingInput = input),
    makeOp: (op, args) =>
      new ASTOperator('xquery', new ast.XQueryIdentifier(op), args),
    resetText: (yy) => {
      const temp = yy.textContent;
      yy.textContent = '';
      return temp;
    },
    ast: {
      ...ast,
      ASTLiteral,
      ASTOperator,
      ASTFunction,
      LangSwitch,
      DOT,
      argPlaceholder: Symbol('argPlaceholder'),
    },
  };

  const parser = new Parser(yy, new Lexer(yy));
  return {
    parse: (input: string) => {
      const result = [parser.parse(input)];
      return {
        value: result,
        remainingInput,
      };
    },
  };
}
