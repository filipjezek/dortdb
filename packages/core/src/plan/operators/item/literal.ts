import { LogicalPlanOperator, LogicalPlanVisitor } from '../../visitor.js';

export class Literal implements LogicalPlanOperator {
  constructor(public lang: Lowercase<string>, public value: any) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitLiteral(this);
  }
}
