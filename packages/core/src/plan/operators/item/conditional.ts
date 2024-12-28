import { LogicalPlanOperator, LogicalPlanVisitor } from '../../visitor.js';

export class Conditional implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public condition: LogicalPlanOperator,
    public whenThens: [LogicalPlanOperator, LogicalPlanOperator][],
    public defaultCase: LogicalPlanOperator
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitConditional(this);
  }
}
