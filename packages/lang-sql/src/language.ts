import {
  ASTFunction,
  ASTOperator,
  LangSwitch,
  Language,
  LanguageManager,
  allAttrs,
  boundParam,
} from '@dortdb/core';
import { sqlLexer as Lexer, sqlParser as Parser } from './parser/sql.cjs';
import { Keywords, AdditionalTokens } from './parser/tokens.js';
import { YyContext } from './parser/yycontext.js';
import * as ast from './ast/index.js';
import { ASTLiteral } from '@dortdb/core';
import { coalesce } from './functions/coalesce.js';
import { SQLLogicalPlanBuilder } from './visitors/builder.js';

export const SQL: Language<'sql'> = {
  name: 'sql',
  operators: [],
  aggregates: [],
  functions: [coalesce],
  castables: [],
  createParser,
  visitors: {
    logicalPlanBuilder: SQLLogicalPlanBuilder,
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
    strContent: '',
    delimiter: '',
    langMgr: mgr,

    messageQueue: [],
    saveRemainingInput: (input) => (remainingInput = input),
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
