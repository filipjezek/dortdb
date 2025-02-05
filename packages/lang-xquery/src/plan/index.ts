import { LogicalPlanVisitor } from '@dortdb/core';
import { TreeJoin } from './tree-join.js';
import { ProjectionSize } from './projection-size.js';
export * from './tree-join.js';
export * from './projection-size.js';

export interface XQueryLogicalPlanVisitor<T> extends LogicalPlanVisitor<T> {
  visitTreeJoin(operator: TreeJoin): T;
  visitProjectionSize(operator: ProjectionSize): T;
}
