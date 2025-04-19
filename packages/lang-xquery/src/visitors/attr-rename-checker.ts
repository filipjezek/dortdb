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
import { RenameMap } from '@dortdb/core/plan';

export class XQueryAttributeRenameChecker
  extends AttributeRenameChecker
  implements XQueryLogicalPlanVisitor<boolean, RenameMap>
{
  constructor(
    vmap: Record<string, LogicalPlanVisitor<boolean, RenameMap>>,
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
