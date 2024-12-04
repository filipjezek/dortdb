import { LogicalPlanOperator, LogicalPlanVisitor } from '../visitor.js';

export class CartesianProduct implements LogicalPlanOperator {
  constructor(
    public readonly left: LogicalPlanOperator,
    public readonly right: LogicalPlanOperator
  ) {}

  accept<T>(visitor: LogicalPlanVisitor<T>): T {
    return visitor.visitCartesianProduct(this);
  }
}
