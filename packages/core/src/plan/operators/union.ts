import { LogicalPlanOperator, LogicalPlanVisitor } from '../visitor.js';

export class Union implements LogicalPlanOperator {
  constructor(
    public left: LogicalPlanOperator,
    public right: LogicalPlanOperator,
    public distinct: boolean = false
  ) {}

  accept<T>(visitor: LogicalPlanVisitor<T>): T {
    return visitor.visitUnion(this);
  }
}