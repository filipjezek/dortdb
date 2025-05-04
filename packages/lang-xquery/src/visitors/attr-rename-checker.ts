import {
  AttributeRenameChecker,
  DortDBAsFriend,
  PlanVisitor,
} from '@dortdb/core';
import { ProjectionSize, TreeJoin, XQueryPlanVisitor } from '../plan/index.js';
import { RenameMap } from '@dortdb/core/plan';

export class XQueryAttributeRenameChecker
  extends AttributeRenameChecker
  implements XQueryPlanVisitor<boolean, RenameMap>
{
  constructor(
    vmap: Record<string, PlanVisitor<boolean, RenameMap>>,
    db: DortDBAsFriend,
  ) {
    super(vmap, db);
  }
  visitTreeJoin(operator: TreeJoin, renamesInv: RenameMap): boolean {
    return (
      this.checkHorizontal(
        operator.step,
        operator.source.schemaSet,
        renamesInv,
      ) && operator.source.accept(this.vmap, renamesInv)
    );
  }
  visitProjectionSize(
    operator: ProjectionSize,
    renamesInv: RenameMap,
  ): boolean {
    return operator.source.accept(this.vmap, renamesInv);
  }
}
