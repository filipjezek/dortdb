import { ASTIdentifier } from '@dortdb/core';
import { assertMaxOne } from '@dortdb/core/internal-fns';
import * as plan from '@dortdb/core/plan';

const src = new plan.TupleSource('sql', ASTIdentifier.fromParts(['Source']));
src.addToSchema([ASTIdentifier.fromParts(['a'])]);

const subq = new plan.TupleSource('sql', ASTIdentifier.fromParts(['Subquery']));
subq.addToSchema([ASTIdentifier.fromParts(['x'])]);

const subqProj = new plan.Projection(
  'sql',
  [[ASTIdentifier.fromParts(['x']), ASTIdentifier.fromParts(['x'])]],
  subq,
);

const unnestSubqueriesTree = new plan.Selection(
  'sql',
  new plan.Calculation(
    'sql',
    assertMaxOne,
    [subqProj],
    [
      {
        originalLocations: [],
        acceptSequence: false,
        maybeSkipped: false,
        usedMultipleTimes: false,
      },
    ],
    subqProj,
  ),
  src,
);

export { unnestSubqueriesTree };
