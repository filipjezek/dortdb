import {
  ASTFunction,
  ASTOperator,
  Language,
  LanguageManager,
} from '@dortdb/core';
import { sqlLexer as Lexer, sqlParser as Parser } from './parser/sql.cjs';
import { Keywords, AdditionalTokens } from './parser/tokens.js';
import { YyContext } from './parser/yycontext.js';
import * as ast from './ast/index.js';
import { ASTLiteral } from '@dortdb/core';
import { coalesce } from './functions/coalesce.js';
import { sum } from './functions/sum.js';
import { count } from './functions/count.js';
import { SQLLogicalPlanBuilder } from './logical-plan/builder.js';

export const SQL: Language<'sql'> = {
  name: 'sql',
  operators: [],
  aggregates: [sum, count],
  functions: [coalesce],
  createParser,
  buildLogicalPlan: (mgr, params, ast) => {
    return ast.accept(new SQLLogicalPlanBuilder(mgr, params));
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
      not ? new ASTOperator('sql', new ast.ASTIdentifier('NOT'), [expr]) : expr,
    makeOp: (op, args) =>
      typeof op === 'string'
        ? new ASTOperator('sql', new ast.ASTIdentifier(op), args)
        : new ASTOperator('sql', op, args),
    allFrom: (src) =>
      new ast.SelectSet([new yy.ast.ASTFieldSelector('*'), src]),
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
