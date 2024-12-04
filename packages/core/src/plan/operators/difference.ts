import { LogicalPlanOperator, LogicalPlanVisitor } from '../visitor.js';

export class Difference implements LogicalPlanOperator {
  constructor(
    public left: LogicalPlanOperator,
    public right: LogicalPlanOperator
  ) {}

  accept<T>(visitor: LogicalPlanVisitor<T>): T {
    return visitor.visitDifference(this);
  }
}
