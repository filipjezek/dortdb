import { AttributeRenamer, DortDBAsFriend, PlanVisitor } from '@dortdb/core';
import { ProjectionSize, TreeJoin, XQueryPlanVisitor } from '../plan/index.js';
import { RenameMap } from '@dortdb/core/plan';

export class XQueryAttributeRenamer
  extends AttributeRenamer
  implements XQueryPlanVisitor<void, RenameMap>
{
  constructor(
    vmap: Record<string, PlanVisitor<void, RenameMap>>,
    db: DortDBAsFriend,
  ) {
    super(vmap, db);
  }
  visitTreeJoin(operator: TreeJoin, renames: RenameMap): void {
    operator.source.accept(this.vmap, renames);
    this.processItem(operator, 'step', operator.dependencies, renames);
  }
  visitProjectionSize(operator: ProjectionSize, renames: RenameMap): void {
    operator.source.accept(this.vmap, renames);
  }
}
