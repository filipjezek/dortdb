import { DescentArgs, EqualityChecker, PlanVisitor } from '@dortdb/core';
import {
  ProjectionSize,
  TreeJoin,
  XQueryPlanVisitor,
} from '@dortdb/lang-xquery';

export class XQueryEqualityChecker
  extends EqualityChecker
  implements XQueryPlanVisitor<boolean, DescentArgs>
{
  constructor(vmap: Record<string, PlanVisitor<boolean, DescentArgs>>) {
    super(vmap);
  }
  visitTreeJoin(a: TreeJoin, args: DescentArgs): boolean {
    const b = args.other as TreeJoin;
    return (
      this.processItem(a.step, { ...args, other: b.step }) &&
      this.processItem(a.source, { ...args, other: b.source })
    );
  }
  visitProjectionSize(a: ProjectionSize, args: DescentArgs): boolean {
    const b = args.other as ProjectionSize;
    return (
      a.sizeCol.equals(b.sizeCol) &&
      this.processItem(a.source, { ...args, other: b.source })
    );
  }
}
