import { LogicalPlanOperator, LogicalPlanVisitor } from '../visitor.js';
import { ProjectionField } from './projection.js';

export class Distinct implements LogicalPlanOperator {
  constructor(
    public exprs: ProjectionField[] | null,
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitor: LogicalPlanVisitor<T>) {
    return visitor.visitDistinct(this);
  }
}
