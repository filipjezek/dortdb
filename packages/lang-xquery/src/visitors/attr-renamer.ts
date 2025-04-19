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
import { RenameMap } from '@dortdb/core/plan';

export class XQueryAttributeRenamer
  extends AttributeRenamer
  implements XQueryLogicalPlanVisitor<void, RenameMap>
{
  constructor(
    vmap: Record<string, LogicalPlanVisitor<void, RenameMap>>,
    db: DortDBAsFriend,
  ) {
    super(vmap, db);
  }
  visitTreeJoin(operator: TreeJoin, renames: RenameMap): void {
    operator.source.accept(this.vmap, renames);
    this.processArray([operator.step], operator.dependencies, renames);
  }
  visitProjectionSize(operator: ProjectionSize, renames: RenameMap): void {
    operator.source.accept(this.vmap, renames);
  }
}
