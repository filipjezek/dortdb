import { ASTIdentifier } from '@dortdb/core';
import * as plan from '@dortdb/core/plan';

const src = new plan.TupleSource('sql', ASTIdentifier.fromParts(['Source']));
src.addToSchema([ASTIdentifier.fromParts(['a'])]);

const fromToItemsTree = new plan.MapFromItem(
  'sql',
  ASTIdentifier.fromParts(['b']),
  new plan.MapToItem('sql', ASTIdentifier.fromParts(['a']), src),
);

export { fromToItemsTree };
