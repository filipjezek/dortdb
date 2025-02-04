import { ASTIdentifier } from '../../../ast.js';
import { LogicalPlanTupleOperator, LogicalPlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export interface Order {
  key: Calculation | ASTIdentifier;
  ascending: boolean;
  nullsFirst: boolean;
}
export class OrderBy extends LogicalPlanTupleOperator {
  constructor(
    public lang: Lowercase<string>,
    public orders: Order[],
    public source: LogicalPlanTupleOperator
  ) {
    super();
    this.schema = source.schema;
    this.schemaSet = source.schemaSet;
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitOrderBy(this);
  }
}
