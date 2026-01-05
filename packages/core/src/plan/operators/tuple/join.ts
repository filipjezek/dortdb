import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { clone } from '../../../internal-fns/index.js';

export class CartesianProduct extends PlanTupleOperator {
  /**
   * if true, the `right` is not allowed to return multiple values per one `left` value
   */
  public validateSingleValue = false;

  constructor(
    lang: Lowercase<string>,
    public left: PlanTupleOperator,
    public right: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema =
      left.schema && right.schema
        ? left.schema.concat(right.schema)
        : left.schema || right.schema || [];
    this.schemaSet = schemaToTrie(this.schema);
    left.parent = this;
    right.parent = this;
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitCartesianProduct(this, arg);
  }
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
  getChildren(): PlanOperator[] {
    return [this.left, this.right];
  }
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

export class Join extends CartesianProduct {
  public leftOuter = false;
  public rightOuter = false;

  constructor(
    lang: Lowercase<string>,
    left: PlanTupleOperator,
    right: PlanTupleOperator,
    public conditions: Calculation[],
  ) {
    super(lang, left, right);
    arrSetParent(this.conditions, this);
  }

  override accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitJoin(this, arg);
  }
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
  override getChildren(): PlanOperator[] {
    return [this.left, this.right, ...this.conditions];
  }
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
