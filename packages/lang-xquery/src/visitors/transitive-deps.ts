import { IdSet, PlanVisitor, TransitiveDependencies } from '@dortdb/core';
import { ProjectionSize, TreeJoin, XQueryPlanVisitor } from '../plan/index.js';
import { union } from '@dortdb/core/utils';

export class XQueryTransitiveDependencies
  extends TransitiveDependencies
  implements XQueryPlanVisitor<IdSet>
{
  constructor(vmap: Record<string, PlanVisitor<IdSet>>) {
    super(vmap);
  }

  visitTreeJoin(operator: TreeJoin): IdSet {
    const tdepsCache = this.getCache();
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal = this.onlyExternal(
      operator.step.accept(this.vmap),
      operator,
    );
    const result = union(horizontal, operator.source.accept(this.vmap));
    tdepsCache.set(operator, result);
    return result;
  }
  visitProjectionSize(operator: ProjectionSize): IdSet {
    const tdepsCache = this.getCache();
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const result = operator.source.accept(this.vmap);
    tdepsCache.set(operator, result);
    return result;
  }
}
