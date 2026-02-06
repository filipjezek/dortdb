import {
  ASTFunction,
  ASTLiteral,
  ASTNode,
  ASTOperator,
  LangSwitch,
  LanguageManager,
  Parser as ParserInterface,
} from '@dortdb/core';
import { DOT } from '../utils/dot.js';
import * as ast from '../ast/index.js';
import { interpretEscape } from '../utils/string.js';
import { PeggyContext } from '../parser/peggy-context.js';
import { parse as peggyParse } from '../parser/xquery.peggy.mjs';

export function createParser(mgr: LanguageManager): ParserInterface {
  const ctx: PeggyContext = {
    langMgr: mgr,
    makeOp: (op, args) =>
      typeof op === 'string'
        ? new ASTOperator(
            'xquery',
            new ast.XQueryIdentifier(op.toLowerCase()),
            args,
          )
        : new ASTOperator('xquery', op, args),
    interpretEscape,
    ast: {
      ...ast,
      ASTLiteral,
      ASTOperator,
      ASTFunction,
      LangSwitch,
      DOT: new ast.ASTVariable(DOT as ast.XQueryIdentifier),
      argPlaceholder: Symbol('argPlaceholder'),
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
      return this.parse(input);
    },
  };
}
