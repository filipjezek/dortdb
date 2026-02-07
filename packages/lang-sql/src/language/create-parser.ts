import {
  ASTFunction,
  ASTNode,
  ASTOperator,
  LangSwitch,
  LanguageManager,
  allAttrs,
  boundParam,
  Parser as ParserInterface,
} from '@dortdb/core';
import { sqlLexer as Lexer, sqlParser as Parser } from '../parser/sql.cjs';
import { Keywords, AdditionalTokens } from '../parser/tokens.js';
import { YyContext } from '../parser/yycontext.js';
import * as ast from '../ast/index.js';
import { ASTLiteral } from '@dortdb/core';
import { PeggyContext } from '../parser/peggy-context.js';
import { parse as peggyParse } from '../parser/sql.peggy.mjs';

const scopeExits = new Set([')', '}', ']']);

export function createParser(mgr: LanguageManager): ParserInterface {
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
    parse(input: string) {
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
    parseExpr(input: string) {
      return this.parse(`SELECT ${input}`);
    },
  };
}

export function createPeggyParser(mgr: LanguageManager): ParserInterface {
  const ctx: PeggyContext = {
    langMgr: mgr,
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

  return {
    parse(input: string) {
      const result = peggyParse(input, {
        peg$library: true,
        ...ctx,
      }) as any as {
        peg$result: { value: ASTNode[]; remainingInput: string };
        peg$curPos: number;
        peg$throw: () => void;
        peg$FAILED: unknown;
      };

      if (result.peg$result === result.peg$FAILED) {
        result.peg$throw();
      }

      return {
        value: result.peg$result.value,
        remainingInput: result.peg$result.remainingInput,
      };
    },
    parseExpr(input: string) {
      return this.parse(`SELECT ${input}`);
    },
  };
}
