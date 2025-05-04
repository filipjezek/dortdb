import {
  ASTFunction,
  ASTLiteral,
  ASTOperator,
  LangSwitch,
  LanguageManager,
  Parser as ParserInterface,
} from '@dortdb/core';
import { AdditionalTokens, Keywords } from '../parser/tokens.js';
import { YyContext } from '../parser/yycontext.js';
import { DOT } from '../utils/dot.js';
import * as ast from '../ast/index.js';
import {
  xqueryLexer as Lexer,
  xqueryParser as Parser,
} from '../parser/xquery.cjs';

const scopeExits = new Set([')', '}', ']']);

export function createParser(mgr: LanguageManager): ParserInterface {
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
    parse(input: string) {
      const result: {
        value: ast.Module;
        scopeExit?: string;
        error?: string;
      } = parser.parse(input);
      let remaining = remainingInput;
      if (scopeExits.has(result.error)) remaining = result.error + remaining;
      if (result.scopeExit) remaining = result.scopeExit + remaining;
      return {
        value: [result.value],
        remainingInput: remaining,
      };
    },
    parseExpr(input: string) {
      return this.parse(input);
    },
  };
}
