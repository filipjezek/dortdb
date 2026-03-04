import { ASTIdentifier } from '@dortdb/core';
import * as plan from '@dortdb/core/plan';

const src = new plan.TupleSource('sql', ASTIdentifier.fromParts(['Source']));
src.addToSchema([
  ASTIdentifier.fromParts(['a']),
  ASTIdentifier.fromParts(['b']),
]);

const fn = new plan.FnCall('sql', [ASTIdentifier.fromParts(['bb'])], () => 1);
const calc = new plan.Calculation(
  'sql',
  () => 1,
  [ASTIdentifier.fromParts(['bb'])],
  [
    {
      originalLocations: [{ obj: fn.args, op: fn, key: 0, idAsFnArg: true }],
    },
  ],
  fn,
);

const mergeProjectionsTree = new plan.Projection(
  'sql',
  [
    [calc, ASTIdentifier.fromParts(['computed'])],
    [ASTIdentifier.fromParts(['aa']), ASTIdentifier.fromParts(['aa'])],
  ],
  new plan.Projection(
    'sql',
    [
      [ASTIdentifier.fromParts(['a']), ASTIdentifier.fromParts(['aa'])],
      [ASTIdentifier.fromParts(['b']), ASTIdentifier.fromParts(['bb'])],
    ],
    src,
  ),
);

export { mergeProjectionsTree };
