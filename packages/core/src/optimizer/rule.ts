import { LogicalPlanOperator } from '../plan/visitor.js';

export interface PatternRule<
  T extends LogicalPlanOperator = LogicalPlanOperator,
> {
  operator: new (...args: any[]) => T;
  match: (node: T) => boolean;
  transform: (node: T) => LogicalPlanOperator;
}
