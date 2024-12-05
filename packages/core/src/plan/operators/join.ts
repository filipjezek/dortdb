import { LogicalPlanOperator, LogicalPlanVisitor } from '../visitor.js';

export class CartesianProduct implements LogicalPlanOperator {
  constructor(public sources: LogicalPlanOperator[]) {}

  accept<T>(visitor: LogicalPlanVisitor<T>): T {
    return visitor.visitCartesianProduct(this);
  }
}
