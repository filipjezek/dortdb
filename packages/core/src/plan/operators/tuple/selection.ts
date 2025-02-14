import { ASTIdentifier } from '../../../ast.js';
import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class Selection extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public condition: Calculation | ASTIdentifier,
    public source: LogicalPlanTupleOperator
  ) {
    super();
    this.lang = lang;
    this.schema = source.schema;
    this.schemaSet = source.schemaSet;
    if (condition instanceof Calculation) condition.parent = this;
    source.parent = this;
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitSelection(this);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator
  ): void {
    if (current === this.condition) {
      this.condition = replacement as Calculation;
    } else {
      this.source = replacement as LogicalPlanTupleOperator;
    }
  }
}
