import { ASTIdentifier } from '../ast.js';
import { LogicalOpOrId, LogicalPlanOperator } from '../plan/visitor.js';

export function arrSetParent(
  arr: LogicalOpOrId[],
  parent: LogicalPlanOperator
) {
  for (const item of arr) {
    if (!(item instanceof ASTIdentifier)) {
      item.parent = parent;
    }
  }
}
