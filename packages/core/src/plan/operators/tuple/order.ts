import { ASTIdentifier } from '../../../ast.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export interface Order {
  key: Calculation | ASTIdentifier;
  ascending: boolean;
  nullsFirst: boolean;
}
export class OrderBy extends LogicalPlanTupleOperator {
  constructor(
    public lang: Lowercase<string>,
    public orders: Order[],
    public source: LogicalPlanTupleOperator
  ) {
    super();
    this.schema = source.schema;
    this.schemaSet = source.schemaSet;
    source.parent = this;
    arrSetParent(
      orders.map((o) => o.key),
      this
    );
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitOrderBy(this);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator
  ): void {
    if (current === this.source) {
      this.source = replacement as LogicalPlanTupleOperator;
    } else {
      this.orders.find((o) => o.key === current).key =
        replacement as Calculation;
    }
  }
}
