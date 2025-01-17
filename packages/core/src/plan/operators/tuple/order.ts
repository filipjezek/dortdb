import { ASTIdentifier } from '../../../ast.js';
import { LogicalPlanTupleOperator, LogicalPlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export interface Order {
  key: Calculation | ASTIdentifier;
  ascending: boolean;
  nullsFirst: boolean;
}
export class OrderBy implements LogicalPlanTupleOperator {
  public schema: ASTIdentifier[];

  constructor(
    public lang: string,
    public orders: Order[],
    public source: LogicalPlanTupleOperator
  ) {
    this.schema = source.schema;
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitOrderBy(this);
  }
}
