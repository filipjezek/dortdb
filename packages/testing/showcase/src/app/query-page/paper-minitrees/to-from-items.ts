import { ASTIdentifier } from '@dortdb/core';
import * as plan from '@dortdb/core/plan';

const src = new plan.ItemSource('sql', ASTIdentifier.fromParts(['Source']));

const toFromItemsTree = new plan.MapToItem(
  'sql',
  ASTIdentifier.fromParts(['a']),
  new plan.MapFromItem('sql', ASTIdentifier.fromParts(['a']), src),
);

export { toFromItemsTree };
