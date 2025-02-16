import { allAttrs, ASTIdentifier } from '../../../ast.js';
import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class Distinct extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public attrs: (ASTIdentifier | Calculation)[] | typeof allAttrs,
    public source: LogicalPlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = source.schema;
    this.schemaSet = source.schemaSet;
    source.parent = this;
  }

  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitDistinct(this, arg);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    if (this.source === current) {
      this.source = replacement as LogicalPlanTupleOperator;
    } else {
      const index = (this.attrs as Calculation[]).indexOf(
        current as Calculation,
      );
      (this.attrs as Calculation[])[index] = replacement as Calculation;
    }
  }
}
