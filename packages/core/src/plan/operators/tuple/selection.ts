import { ASTIdentifier } from '../../../ast.js';
import { LogicalPlanTupleOperator, LogicalPlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class Selection extends LogicalPlanTupleOperator {
  constructor(
    public lang: Lowercase<string>,
    public condition: Calculation | ASTIdentifier,
    public source: LogicalPlanTupleOperator
  ) {
    super();
    this.schema = source.schema;
    this.schemaSet = source.schemaSet;
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitSelection(this);
  }
}
