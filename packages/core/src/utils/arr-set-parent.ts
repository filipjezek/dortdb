import { ASTIdentifier } from '../ast.js';
import { OpOrId, PlanOperator } from '../plan/visitor.js';

export function arrSetParent(arr: OpOrId[], parent: PlanOperator) {
  for (const item of arr) {
    if (!(item instanceof ASTIdentifier)) {
      item.parent = parent;
    }
  }
}
