import {
  AttributeRenameChecker,
  DortDBAsFriend,
  LogicalPlanVisitor,
} from '@dortdb/core';
import {
  ProjectionSize,
  TreeJoin,
  XQueryLogicalPlanVisitor,
} from '../plan/index.js';

export class XQueryAttributeRenameChecker
  extends AttributeRenameChecker
  implements XQueryLogicalPlanVisitor<boolean>
{
  constructor(
    vmap: Record<string, LogicalPlanVisitor<boolean>>,
    db: DortDBAsFriend,
  ) {
    super(vmap, db);
  }
  visitTreeJoin(operator: TreeJoin): boolean {
    return (
      this.checkHorizontal(operator.step, operator.source.schemaSet) &&
      operator.source.accept(this.vmap)
    );
  }
  visitProjectionSize(operator: ProjectionSize): boolean {
    return operator.source.accept(this.vmap);
  }
}
