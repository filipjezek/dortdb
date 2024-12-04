import { LogicalPlanOperator, LogicalPlanVisitor } from '../visitor.js';

export class Limit implements LogicalPlanOperator {
  constructor(
    public skip: number,
    public limit: number,
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitor: LogicalPlanVisitor<T>): T {
    return visitor.visitLimit(this);
  }
}
