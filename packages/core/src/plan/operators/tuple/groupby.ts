import { ASTIdentifier } from '../../../ast.js';
import { LogicalPlanOperator, LogicalPlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export const grouped = Symbol('grouped');
export class GroupBy implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public aggKey: ASTIdentifier,
    public keys: (ASTIdentifier | Calculation)[],
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitGroupBy(this);
  }
}
