import { ASTIdentifier } from '../ast.js';
import { CalculationParams } from '../visitors/calculation-builder.js';

export function resolveArgs(
  args: any[],
  children: (ASTIdentifier | CalculationParams)[]
) {
  let i = 0;
  return children.map((ch) => {
    if (ch instanceof ASTIdentifier) {
      return args[i++];
    }
    return ch.impl(...args.slice(i, (i += ch.args.length)));
  });
}
