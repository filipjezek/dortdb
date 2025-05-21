import { ASTIdentifier } from '../../../ast.js';
import { cloneIfPossible, isCalc, isId } from '../../../internal-fns/index.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export function getKey(o: Order) {
  return o.key;
}

export interface Order {
  key: Calculation | ASTIdentifier;
  ascending: boolean;
  nullsFirst: boolean;
}
export class OrderBy extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public orders: Order[],
    public source: PlanTupleOperator,
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
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitOrderBy(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    if (current === this.source) {
      this.source = replacement as PlanTupleOperator;
    } else {
      this.orders.find((o) => o.key === current).key =
        replacement as Calculation;
    }
  }
  getChildren(): PlanOperator[] {
    const res: PlanOperator[] = this.orders.map(getKey).filter(isCalc);
    res.push(this.source);
    return res;
  }
  clone(): OrderBy {
    return new OrderBy(
      this.lang,
      this.orders.map((o) => ({
        key: cloneIfPossible(o.key),
        ascending: o.ascending,
        nullsFirst: o.nullsFirst,
      })),
      this.source.clone(),
    );
  }
}
