import { ASTIdentifier } from '../../../ast.js';
import { cloneIfPossible, isCalc, isId } from '../../../internal-fns/index.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { schemaToTrie } from '../../../utils/trie.js';
import {
  OpOrId,
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

/** Extracts the sort key from an {@link Order} descriptor; used as a helper for array mapping. */
export function getKey(o: Order) {
  return o.key;
}

/** Describes a single sort term in an {@link OrderBy} operator. */
export interface Order {
  /** The expression or attribute to sort by. */
  key: Calculation | ASTIdentifier;
  /** Sort direction: `true` for ascending, `false` for descending. */
  ascending: boolean;
  /** Whether `null` values sort before non-null values. */
  nullsFirst: boolean;
}

/** Sorts its source stream according to one or more {@link Order} descriptors. */
export class OrderBy extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** Ordered list of sort terms applied left-to-right. */
    public orders: Order[],
    /** Tuple operator providing the input rows. */
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

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitOrderBy(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(current: PlanOperator, replacement: OpOrId): void {
    const isId = replacement instanceof ASTIdentifier;
    if (!isId) {
      replacement.parent = this;
    }
    if (current === this.source) {
      if (isId) {
        throw new Error('cannot replace source with an identifier');
      }
      this.source = replacement as PlanTupleOperator;
    } else {
      this.orders.find((o) => o.key === current).key = replacement as
        | Calculation
        | ASTIdentifier;
    }
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    const res: PlanOperator[] = this.orders.map(getKey).filter(isCalc);
    res.push(this.source);
    return res;
  }
  /** {@inheritDoc PlanOperator.clone} */
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
