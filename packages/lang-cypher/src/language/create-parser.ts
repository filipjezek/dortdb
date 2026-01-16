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
import { PeggyContext } from '../parser/peggy-context.js';
import * as ast from '../ast/index.js';
import { parse as peggyParse } from '../parser/cypher.peggy.mjs';

export function createParser(mgr: LanguageManager): ParserInterface {
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
        peg$result: { value: ASTNode; remainingInput: string };
        peg$curPos: number;
        peg$throw: () => void;
        peg$FAILED: unknown;
      };

      if (result.peg$result === result.peg$FAILED) {
        result.peg$throw();
      }

      return {
        value: [result.peg$result.value],
        remainingInput: result.peg$result.remainingInput,
      };
    },
    parseExpr(input: string) {
      return this.parse(`RETURN ${input}`);
    },
  };
}
