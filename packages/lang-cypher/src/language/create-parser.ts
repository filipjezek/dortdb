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
  Parser as ParserInterface,
} from '@dortdb/core';
import { AdditionalTokens, Keywords } from '../parser/tokens.js';
import { PeggyContext, YyContext } from '../parser/yycontext.js';
import * as ast from '../ast/index.js';
import {
  cypherParser as Parser,
  cypherLexer as Lexer,
} from '../parser/cypher.cjs';
import { parse as peggyParse } from '../parser/cypher.peggy.mjs';

const scopeExits = [')', '}', ']'];

export function createParser(mgr: LanguageManager): ParserInterface {
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
    parse(input: string) {
      const result: {
        value: ASTNode[];
        scopeExit?: string;
        error?: string;
      } = parser.parse(input);
      let remaining = remainingInput;
      if (scopeExits.includes(result.error))
        remaining = result.error + remaining;
      if (result.scopeExit) remaining = result.scopeExit + remaining;
      return {
        value: result.value,
        remainingInput: remaining,
      };
    },
    parseExpr(input: string) {
      return this.parse(`RETURN ${input}`);
    },
  };
}

export function createPeggyParser(mgr: LanguageManager): ParserInterface {
  const ctx: PeggyContext = {
    langMgr: mgr,
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

  return {
    parse(input: string) {
      const result = peggyParse(input, {
        peg$library: true,
        ...ctx,
      }) as any as {
        peg$result: ASTNode;
        peg$curPos: number;
        peg$throw: () => void;
        peg$FAILED: unknown;
      };

      if (result.peg$result === result.peg$FAILED) {
        result.peg$throw();
      }

      return {
        value: [result.peg$result],
        remainingInput: input.slice(result.peg$curPos),
      };
    },
    parseExpr(input: string) {
      return this.parse(`RETURN ${input}`);
    },
  };
}
