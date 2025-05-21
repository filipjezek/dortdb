import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class Recursion extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public min: number,
    public max: number,
    /** any referenced attributes of the input tuples will be resolved as `[first, second]` */
    public condition: Calculation,
    public source: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = source.schema;
    this.schemaSet = source.schemaSet;
    if (condition) {
      condition.parent = this;
    }
    source.parent = this;
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitRecursion(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    if (current === this.condition) {
      this.condition = replacement as Calculation;
    } else {
      this.source = replacement as PlanTupleOperator;
    }
  }
  getChildren(): PlanOperator[] {
    return [this.source, this.condition];
  }
  clone(): Recursion {
    return new Recursion(
      this.lang,
      this.min,
      this.max,
      this.condition.clone(),
      this.source.clone(),
    );
  }
}
