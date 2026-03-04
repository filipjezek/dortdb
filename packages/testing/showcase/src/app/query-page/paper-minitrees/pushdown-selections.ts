import { ASTIdentifier } from '@dortdb/core';
import * as plan from '@dortdb/core/plan';

const srcLeft = new plan.TupleSource('sql', ASTIdentifier.fromParts(['Left']));
const srcRight = new plan.TupleSource(
  'sql',
  ASTIdentifier.fromParts(['Right']),
);
srcLeft.addToSchema([ASTIdentifier.fromParts(['a'])]);
srcRight.addToSchema([ASTIdentifier.fromParts(['a'])]);

const pushdownSelectionsSetOpTree = new plan.Selection(
  'sql',
  new plan.Calculation('sql', () => 1, [ASTIdentifier.fromParts(['a'])], []),
  new plan.Union('sql', srcLeft, srcRight),
);

const src = new plan.TupleSource('sql', ASTIdentifier.fromParts(['Source']));
src.addToSchema([ASTIdentifier.fromParts(['a'])]);
const pushdownSelectionsProjTree = new plan.Selection(
  'sql',
  new plan.Calculation('sql', () => 1, [ASTIdentifier.fromParts(['b'])], []),
  new plan.Projection(
    'sql',
    [[ASTIdentifier.fromParts(['a']), ASTIdentifier.fromParts(['b'])]],
    src,
  ),
);

export { pushdownSelectionsSetOpTree, pushdownSelectionsProjTree };
