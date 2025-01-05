import { allAttrs, ASTIdentifier } from '../../../ast.js';
import { LogicalPlanTupleOperator, LogicalPlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class Distinct implements LogicalPlanTupleOperator {
  public schema: ASTIdentifier[];

  constructor(
    public lang: string,
    public attrs: (ASTIdentifier | Calculation)[] | typeof allAttrs,
    public source: LogicalPlanTupleOperator
  ) {
    this.schema = source.schema;
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitDistinct(this);
  }
}
