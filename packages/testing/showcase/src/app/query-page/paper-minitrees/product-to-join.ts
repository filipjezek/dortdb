import { ASTIdentifier } from '@dortdb/core';
import * as plan from '@dortdb/core/plan';

const op1 = new plan.TupleSource('sql', ASTIdentifier.fromParts(['Op1']));
op1.addToSchema(ASTIdentifier.fromParts(['a']));
const op2 = new plan.TupleSource('sql', ASTIdentifier.fromParts(['Op2']));
op2.addToSchema(ASTIdentifier.fromParts(['b']));

const productToJoinTree = new plan.Selection(
  'sql',
  new plan.Calculation(
    'sql',
    () => 1,
    [ASTIdentifier.fromParts(['a']), ASTIdentifier.fromParts(['b'])],
    [],
  ),
  new plan.CartesianProduct('sql', op1, op2),
);

export { productToJoinTree };
