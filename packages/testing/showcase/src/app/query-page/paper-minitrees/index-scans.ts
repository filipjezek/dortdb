import { ASTIdentifier } from '@dortdb/core';
import * as plan from '@dortdb/core/plan';

const op1 = new plan.TupleSource('sql', ASTIdentifier.fromParts(['Source']));
op1.addToSchema(ASTIdentifier.fromParts(['a']));
const fn = new plan.FnCall(
  'sql',
  [ASTIdentifier.fromParts(['a']), ASTIdentifier.fromParts(['external'])],
  () => 1,
);
const calc = new plan.Calculation(
  'sql',
  () => 1,
  [ASTIdentifier.fromParts(['a']), ASTIdentifier.fromParts(['external'])],
  [
    {
      originalLocations: [{ obj: fn.args, op: fn, key: 0, idAsFnArg: true }],
    },
    {
      originalLocations: [{ obj: fn.args, op: fn, key: 1, idAsFnArg: true }],
    },
  ],
  fn,
);

const indexScansTree = new plan.Selection('sql', calc, op1);

export { indexScansTree };
