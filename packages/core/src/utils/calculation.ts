import { ASTIdentifier } from '../ast.js';
import { ret1 } from '../internal-fns/index.js';
import { Calculation, FnCall } from '../plan/operators/index.js';

export function idToCalculation(id: ASTIdentifier, lang: Lowercase<string>) {
  const fn = new FnCall(lang, [id], ret1);
  return new Calculation(
    lang,
    ret1,
    [id],
    [{ originalLocations: [[fn.args, 0]] }],
    fn,
    [],
    false,
  );
}
