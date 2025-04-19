import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';

export class Limit extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public skip: number,
    public limit: number,
    public source: LogicalPlanOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = (source as LogicalPlanTupleOperator).schema;
    this.schemaSet = (source as LogicalPlanTupleOperator).schemaSet;
    source.parent = this;
  }

  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitLimit(this, arg);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    replacement.parent = this;
    this.source = replacement;
  }
  getChildren(): LogicalPlanOperator[] {
    return [this.source];
  }
}
