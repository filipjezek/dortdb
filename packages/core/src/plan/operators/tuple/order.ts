import { ASTIdentifier } from '../../../ast.js';
import { isCalc, isId } from '../../../internal-fns/index.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { schemaToTrie } from '../../../utils/trie.js';
import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export function getKey(o: Order) {
  return o.key;
}

export interface Order {
  key: Calculation | ASTIdentifier;
  ascending: boolean;
  nullsFirst: boolean;
}
export class OrderBy extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public orders: Order[],
    public source: LogicalPlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = source.schema;
    this.schemaSet = source.schemaSet;
    source.parent = this;
    arrSetParent(orders.map(getKey), this);
    this.dependencies = schemaToTrie(this.orders.map(getKey).filter(isId));
  }

  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitOrderBy(this, arg);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    if (current === this.source) {
      this.source = replacement as LogicalPlanTupleOperator;
    } else {
      this.orders.find((o) => o.key === current).key =
        replacement as Calculation;
    }
  }
  getChildren(): LogicalPlanOperator[] {
    const res: LogicalPlanOperator[] = this.orders.map(getKey).filter(isCalc);
    res.push(this.source);
    return res;
  }
}
