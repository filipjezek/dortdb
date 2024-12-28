import { LogicalPlanOperator, LogicalPlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class Selection implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public condition: Calculation,
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitSelection(this);
  }
}
