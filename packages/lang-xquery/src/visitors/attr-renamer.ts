import {
  AttributeRenamer,
  DortDBAsFriend,
  LogicalPlanVisitor,
} from '@dortdb/core';
import {
  ProjectionSize,
  TreeJoin,
  XQueryLogicalPlanVisitor,
} from '../plan/index.js';

export class XQueryAttributeRenamer
  extends AttributeRenamer
  implements XQueryLogicalPlanVisitor<void>
{
  constructor(
    vmap: Record<string, LogicalPlanVisitor<void>>,
    db: DortDBAsFriend,
  ) {
    super(vmap, db);
  }
  visitTreeJoin(operator: TreeJoin): void {
    operator.source.accept(this.vmap);
    this.processArray([operator.step], operator.dependencies);
  }
  visitProjectionSize(operator: ProjectionSize): void {
    operator.source.accept(this.vmap);
  }
}
