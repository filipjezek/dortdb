import { LogicalPlanOperator, LogicalPlanVisitor } from '../visitor.js';
import { Calculation } from './calculation.js';

export class Selection implements LogicalPlanOperator {
  constructor(
    public predicate: Calculation,
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitor: LogicalPlanVisitor<T>): T {
    return visitor.visitSelection(this);
  }
}
