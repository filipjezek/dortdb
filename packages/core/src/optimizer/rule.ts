import { LogicalPlanOperator } from '../plan/visitor.js';

export interface Rule {
  operator: new (...args: any[]) => LogicalPlanOperator;
  match: (node: LogicalPlanOperator) => boolean;
  transform: (
    node: LogicalPlanOperator,
  ) => LogicalPlanOperator | Iterable<LogicalPlanOperator>;
}
