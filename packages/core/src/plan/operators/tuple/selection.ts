import { ASTIdentifier } from '../../../ast.js';
import { LogicalPlanTupleOperator, LogicalPlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class Selection implements LogicalPlanTupleOperator {
  public schema: ASTIdentifier[];

  constructor(
    public lang: string,
    public condition: Calculation | ASTIdentifier,
    public source: LogicalPlanTupleOperator
  ) {
    this.schema = source.schema;
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitSelection(this);
  }
}
