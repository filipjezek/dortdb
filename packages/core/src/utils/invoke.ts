import { ASTIdentifier } from '../ast.js';
import { CalculationParams } from '../visitors/calculation-builder.js';

export function resolveArgs(
  args: any[],
  children: (ASTIdentifier | CalculationParams)[]
) {
  let i = 0;
  const res: any[] = [];
  for (const ch of children) {
    if (ch instanceof ASTIdentifier) {
      res.push(args[i++]);
    } else {
      res.push(ch.impl(...args.slice(i, (i += ch.args.length))));
    }
  }
  return res;
}
