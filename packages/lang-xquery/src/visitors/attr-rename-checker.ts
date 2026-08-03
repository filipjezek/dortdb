import {
  ArcDescentArgs,
  AttributeRenameChecker,
  DortDBAsFriend,
  PlanVisitor,
} from '@dortdb/core';
import { ProjectionSize, TreeJoin, XQueryPlanVisitor } from '../plan/index.js';
import { RenameMap } from '@dortdb/core/plan';

/**
 * Extends {@link AttributeRenameChecker} to handle the XQuery-specific
 * {@link TreeJoin} and {@link ProjectionSize} plan operators.
 */
export class XQueryAttributeRenameChecker
  extends AttributeRenameChecker
  implements XQueryPlanVisitor<boolean, ArcDescentArgs>
{
  constructor(
    vmap: Record<string, PlanVisitor<boolean, ArcDescentArgs>>,
    db: DortDBAsFriend,
  ) {
    super(vmap, db);
  }
  visitTreeJoin(operator: TreeJoin, args: ArcDescentArgs): boolean {
    return (
      this.checkHorizontal(operator.step, operator.source.schemaSet, args) &&
      operator.source.accept(this.vmap, args)
    );
  }
  visitProjectionSize(operator: ProjectionSize, args: ArcDescentArgs): boolean {
    return (
      !args.renamesInv.has(operator.sizeCol.parts) &&
      operator.source.accept(this.vmap, args)
    );
  }
}
