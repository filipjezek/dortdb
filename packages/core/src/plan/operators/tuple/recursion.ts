import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class Recursion extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public min: number,
    public max: number,
    /** any referenced attributes of the input tuples will be resolved as `[first, second]` */
    public condition: Calculation,
    public source: LogicalPlanTupleOperator,
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
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitRecursion(this, arg);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    if (current === this.condition) {
      this.condition = replacement as Calculation;
    } else {
      this.source = replacement as LogicalPlanTupleOperator;
    }
  }
}
