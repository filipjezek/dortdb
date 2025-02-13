import { LogicalPlanOperator, LogicalPlanVisitor } from '../../visitor.js';

export enum QuantifierType {
  ALL = 'all',
  ANY = 'any',
}
export class Quantifier implements LogicalPlanOperator {
  constructor(
    public lang: Lowercase<string>,
    public type: QuantifierType,
    public query: LogicalPlanOperator
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitQuantifier(this);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator
  ): void {
    throw new Error('Method not implemented.');
  }
}
