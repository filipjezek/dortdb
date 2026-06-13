import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { clone } from '../../../internal-fns/index.js';

/**
 * Computes the Cartesian product of two tuple streams, concatenating their schemas.
 *
 * Columns present in both `left` and `right` are taken from `right` (right wins).
 */
export class CartesianProduct extends PlanTupleOperator {
  /**
   * if true, the `right` is not allowed to return multiple values per one `left` value
   */
  public validateSingleValue = false;

  constructor(
    lang: Lowercase<string>,
    /** Left input tuple stream. */
    public left: PlanTupleOperator,
    /** Right input tuple stream. */
    public right: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema =
      left.schema && right.schema
        ? left.schema
            .filter((x) => !right.schemaSet.has(x.parts))
            .concat(right.schema)
        : left.schema || right.schema || [];
    this.schemaSet = schemaToTrie(this.schema);
    left.parent = this;
    right.parent = this;
  }

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitCartesianProduct(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(
    current: PlanTupleOperator,
    replacement: PlanTupleOperator,
  ): void {
    replacement.parent = this;
    if (current === this.left) {
      this.left = replacement as PlanTupleOperator;
    } else {
      this.right = replacement as PlanTupleOperator;
    }
    this.clearSchema();
    this.addToSchema(this.left.schema);
    this.addToSchema(this.right.schema);
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return [this.left, this.right];
  }
  /** {@inheritDoc PlanOperator.clone} */
  clone(): CartesianProduct {
    const res = new CartesianProduct(
      this.lang,
      this.left.clone(),
      this.right.clone(),
    );
    res.validateSingleValue = this.validateSingleValue;
    return res;
  }
}

/**
 * A join with explicit predicates; extends {@link CartesianProduct} by filtering rows
 * with `conditions` and supporting outer-join semantics via `leftOuter`/`rightOuter`.
 */
export class Join extends CartesianProduct {
  /** When `true`, unmatched rows from `left` are emitted with `null`-filled `right` columns. */
  public leftOuter = false;
  /** When `true`, unmatched rows from `right` are emitted with `null`-filled `left` columns. */
  public rightOuter = false;

  constructor(
    lang: Lowercase<string>,
    left: PlanTupleOperator,
    right: PlanTupleOperator,
    /** Join predicates; all must hold for a pair of rows to be included. */
    public conditions: Calculation[],
  ) {
    super(lang, left, right);
    arrSetParent(this.conditions, this);
  }

  /** {@inheritDoc PlanOperator.accept} */
  override accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitJoin(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  override replaceChild(
    current: PlanOperator,
    replacement: PlanOperator,
  ): void {
    replacement.parent = this;
    for (let i = 0; i < this.conditions.length; i++) {
      if (this.conditions[i] === current) {
        this.conditions[i] = replacement as Calculation;
        return;
      }
    }
    super.replaceChild(
      current as PlanTupleOperator,
      replacement as PlanTupleOperator,
    );
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  override getChildren(): PlanOperator[] {
    return [this.left, this.right, ...this.conditions];
  }
  /** {@inheritDoc PlanOperator.clone} */
  override clone(): Join {
    const res = new Join(
      this.lang,
      this.left.clone(),
      this.right.clone(),
      this.conditions.map(clone),
    );
    res.leftOuter = this.leftOuter;
    res.rightOuter = this.rightOuter;
    return res;
  }
}
