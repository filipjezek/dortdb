import { ASTIdentifier } from '../ast.js';
import { OpOrId, PlanOperator } from '../plan/visitor.js';

/** Sets the `parent` reference on every non-identifier element in `arr` to `parent`. */
export function arrSetParent(arr: OpOrId[], parent: PlanOperator) {
  for (const item of arr) {
    if (!(item instanceof ASTIdentifier)) {
      item.parent = parent;
    }
  }
}
