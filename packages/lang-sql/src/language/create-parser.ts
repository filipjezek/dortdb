import {
  ASTFunction,
  ASTOperator,
  LangSwitch,
  LanguageManager,
  allAttrs,
  boundParam,
} from '@dortdb/core';
import { sqlLexer as Lexer, sqlParser as Parser } from '../parser/sql.cjs';
import { Keywords, AdditionalTokens } from '../parser/tokens.js';
import { YyContext } from '../parser/yycontext.js';
import * as ast from '../ast/index.js';
import { ASTLiteral } from '@dortdb/core';

export function createParser(mgr: LanguageManager) {
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
    saveRemainingInput: (input) => {
      if (remainingInput.slice(0, -input.length).match(/^\s*[)}\]]\s*$/)) {
        return;
      }
      remainingInput = input;
    },
    wrapNot: (expr, not) =>
      not ? new ASTOperator('sql', new ast.SQLIdentifier('NOT'), [expr]) : expr,
    makeOp: (op, args) =>
      typeof op === 'string'
        ? new ASTOperator('sql', new ast.SQLIdentifier(op), args)
        : new ASTOperator('sql', op, args),
    allFrom: (src) => new ast.SelectSet([new ast.SQLIdentifier(allAttrs)], src),
    parentOp: (op, parent) => {
      if (op instanceof ast.ASTQuantifier) {
        op.parentOp = parent;
      }
    },
    ast: {
      ...ast,
      ASTLiteral,
      ASTOperator,
      ASTFunction,
      LangSwitch,
      allAttrs,
      boundParam,
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
