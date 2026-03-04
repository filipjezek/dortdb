import { ASTIdentifier } from '@dortdb/core';
import * as plan from '@dortdb/core/plan';

const op1 = new plan.TupleSource('sql', ASTIdentifier.fromParts(['Op1']));
op1.addToSchema(ASTIdentifier.fromParts(['a']));
const op2 = new plan.TupleSource('sql', ASTIdentifier.fromParts(['Op2']));
op2.addToSchema(ASTIdentifier.fromParts(['b']));
const fn = new plan.FnCall(
  'sql',
  [ASTIdentifier.fromParts(['a']), ASTIdentifier.fromParts(['b'])],
  () => 1,
);

const joinIndicesTree = new plan.Join('sql', op1, op2, [
  new plan.Calculation(
    'sql',
    () => 1,
    [ASTIdentifier.fromParts(['a']), ASTIdentifier.fromParts(['b'])],
    [
      {
        originalLocations: [{ obj: fn.args, op: fn, key: 0, idAsFnArg: true }],
      },
      {
        originalLocations: [{ obj: fn.args, op: fn, key: 1, idAsFnArg: true }],
      },
    ],
    fn,
  ),
]);

export { joinIndicesTree };
