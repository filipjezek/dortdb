import { LogicalPlanVisitor } from '@dortdb/core';
import { TreeJoin } from './tree-join.js';
export * from './tree-join.js';

export interface XQueryLogicalPlanVisitor<T> extends LogicalPlanVisitor<T> {
  visitTreeJoin(treeStep: TreeJoin): T;
}
