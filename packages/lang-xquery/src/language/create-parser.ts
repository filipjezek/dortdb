import {
  ASTFunction,
  ASTLiteral,
  ASTOperator,
  LangSwitch,
  LanguageManager,
} from '@dortdb/core';
import { AdditionalTokens, Keywords } from 'src/parser/tokens.js';
import { YyContext } from 'src/parser/yycontext.js';
import { DOT } from 'src/utils/dot.js';
import * as ast from 'src/ast/index.js';
import {
  xqueryLexer as Lexer,
  xqueryParser as Parser,
} from '../parser/xquery.cjs';

export function createParser(mgr: LanguageManager) {
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
    saveRemainingInput: (input) => {
      if (remainingInput.slice(0, -input.length).match(/^\s*[)}\]]\s*$/)) {
        return;
      }
      remainingInput = input;
    },
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
