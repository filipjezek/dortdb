import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../../visitor.js';

/** Skips the first `skip` rows of its source and then passes at most `limit` rows through. */
export class Limit extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** Number of leading rows to skip. */
    public skip: number,
    /** Maximum number of rows to emit; `Infinity` means no upper bound. */
    public limit: number,
    /** Tuple operator to read from. */
    public source: PlanOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = (source as PlanTupleOperator).schema;
    this.schemaSet = (source as PlanTupleOperator).schemaSet;
    source.parent = this;
  }

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitLimit(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    this.source = replacement;
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return [this.source];
  }
  /** {@inheritDoc PlanOperator.clone} */
  clone(): Limit {
    return new Limit(this.lang, this.skip, this.limit, this.source.clone());
  }
}
