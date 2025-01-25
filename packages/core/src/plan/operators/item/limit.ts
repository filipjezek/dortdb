import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';

export class Limit extends LogicalPlanTupleOperator {
  constructor(
    public lang: string,
    public skip: number,
    public limit: number,
    public source: LogicalPlanOperator
  ) {
    super();
    this.schema = (source as LogicalPlanTupleOperator).schema;
    this.schemaSet = (source as LogicalPlanTupleOperator).schemaSet;
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitLimit(this);
  }
}
