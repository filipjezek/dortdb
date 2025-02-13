import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';

export class Limit extends LogicalPlanTupleOperator {
  constructor(
    public lang: Lowercase<string>,
    public skip: number,
    public limit: number,
    public source: LogicalPlanOperator
  ) {
    super();
    this.schema = (source as LogicalPlanTupleOperator).schema;
    this.schemaSet = (source as LogicalPlanTupleOperator).schemaSet;
    source.parent = this;
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitLimit(this);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator
  ): void {
    this.source = replacement;
  }
}
