import {
  IdSet,
  LogicalPlanVisitor,
  TransitiveDependencies,
} from '@dortdb/core';
import {
  ProjectionSize,
  TreeJoin,
  XQueryLogicalPlanVisitor,
} from '../plan/index.js';
import { union } from '@dortdb/core/utils';

export class XQueryTransitiveDependencies
  extends TransitiveDependencies
  implements XQueryLogicalPlanVisitor<IdSet>
{
  constructor(vmap: Record<string, LogicalPlanVisitor<IdSet>>) {
    super(vmap);
  }

  visitTreeJoin(operator: TreeJoin): IdSet {
    const tdepsCache = this.getCache();
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal = this.onlyExternal(
      operator.step.accept(this.vmap),
      operator,
    );
    return union(horizontal, operator.source.accept(this.vmap));
  }
  visitProjectionSize(operator: ProjectionSize): IdSet {
    const tdepsCache = this.getCache();
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    return operator.source.accept(this.vmap);
  }
}
