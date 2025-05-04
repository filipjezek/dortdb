import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../../visitor.js';

export class Limit extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public skip: number,
    public limit: number,
    public source: PlanOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = (source as PlanTupleOperator).schema;
    this.schemaSet = (source as PlanTupleOperator).schemaSet;
    source.parent = this;
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitLimit(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    this.source = replacement;
  }
  getChildren(): PlanOperator[] {
    return [this.source];
  }
}
