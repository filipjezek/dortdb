import { allAttrs, ASTIdentifier } from '../../../ast.js';
import { LogicalPlanTupleOperator, LogicalPlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class Distinct extends LogicalPlanTupleOperator {
  constructor(
    public lang: Lowercase<string>,
    public attrs: (ASTIdentifier | Calculation)[] | typeof allAttrs,
    public source: LogicalPlanTupleOperator
  ) {
    super();
    this.schema = source.schema;
    this.schemaSet = source.schemaSet;
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitDistinct(this);
  }
}
