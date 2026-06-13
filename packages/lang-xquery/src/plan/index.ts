import { PlanVisitor } from '@dortdb/core';
import { TreeJoin } from './tree-join.js';
import { ProjectionSize } from './projection-size.js';
export * from './tree-join.js';
export * from './projection-size.js';

/**
 * Extension of {@link PlanVisitor} with handlers for the XQuery-specific plan
 * operators {@link TreeJoin} and {@link ProjectionSize}.
 */
export interface XQueryPlanVisitor<Ret, Arg = never>
  extends PlanVisitor<Ret, Arg> {
  visitTreeJoin(operator: TreeJoin, arg?: Arg): Ret;
  visitProjectionSize(operator: ProjectionSize, arg?: Arg): Ret;
}
