import { ASTIdentifier } from '../ast.js';
import { CalculationParams } from '../visitors/calculation-builder.js';

/**
 * Distributes flat `args` across `children`: identifiers consume one argument,
 * nested {@link CalculationParams} consume as many as their own arg count and
 * are evaluated inline.
 */
export function resolveArgs(
  args: unknown[],
  children: (ASTIdentifier | CalculationParams)[],
) {
  let i = 0;
  const res: unknown[] = [];
  for (const ch of children) {
    if (ch instanceof ASTIdentifier) {
      res.push(args[i++]);
    } else {
      res.push(ch.impl(...args.slice(i, (i += ch.args.length))));
    }
  }
  return res;
}
