import { ASTIdentifier } from '../../../ast.js';
import { LogicalPlanOperator, LogicalPlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export interface Order {
  key: Calculation | ASTIdentifier;
  ascending: boolean;
}
export class OrderBy implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public orders: Order[],
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitOrderBy(this);
  }
}
