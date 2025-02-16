import { LogicalPlanVisitor } from '@dortdb/core';
import { TreeJoin } from './tree-join.js';
import { ProjectionSize } from './projection-size.js';
export * from './tree-join.js';
export * from './projection-size.js';

export interface XQueryLogicalPlanVisitor<Ret, Arg = never>
  extends LogicalPlanVisitor<Ret, Arg> {
  visitTreeJoin(operator: TreeJoin, arg?: Arg): Ret;
  visitProjectionSize(operator: ProjectionSize, arg?: Arg): Ret;
}
