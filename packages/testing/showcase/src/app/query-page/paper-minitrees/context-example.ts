import { ASTIdentifier } from '@dortdb/core';
import { assertMaxOne } from '@dortdb/core/internal-fns';
import * as plan from '@dortdb/core/plan';

const src = new plan.TupleSource('sql', ASTIdentifier.fromParts(['Source']));
src.addToSchema([ASTIdentifier.fromParts(['a'])]);

const subq = new plan.TupleSource('sql', ASTIdentifier.fromParts(['Subquery']));
subq.addToSchema([ASTIdentifier.fromParts(['x'])]);

const subqProj = new plan.Projection(
  'sql',
  [
    [
      new plan.Calculation(
        'sql',
        assertMaxOne,
        [ASTIdentifier.fromParts(['x']), ASTIdentifier.fromParts(['a'])],
        [],
      ),
      ASTIdentifier.fromParts(['y']),
    ],
  ],
  subq,
);

const srcSelection = new plan.Selection(
  'sql',
  new plan.Calculation(
    'sql',
    assertMaxOne,
    [ASTIdentifier.fromParts(['a'])],
    [],
  ),
  src,
);

const contextExampleTree = new plan.Projection(
  'sql',
  [[ASTIdentifier.fromParts(['y']), ASTIdentifier.fromParts(['y'])]],
  new plan.ProjectionConcat('sql', subqProj, false, srcSelection),
);

export { contextExampleTree };
