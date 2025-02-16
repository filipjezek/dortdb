import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';
import { schemaToTrie } from '../../../utils/trie.js';

export class CartesianProduct extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public left: LogicalPlanTupleOperator,
    public right: LogicalPlanTupleOperator,
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
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitCartesianProduct(this, arg);
  }
  replaceChild(
    current: LogicalPlanTupleOperator,
    replacement: LogicalPlanTupleOperator,
  ): void {
    if (current === this.left) {
      this.left = replacement as LogicalPlanTupleOperator;
    } else {
      this.right = replacement as LogicalPlanTupleOperator;
    }
    this.clearSchema();
    this.addToSchema(this.left.schema);
    this.addToSchema(this.right.schema);
  }
}

export class Join extends CartesianProduct {
  public leftOuter = false;
  public rightOuter = false;

  constructor(
    lang: Lowercase<string>,
    left: LogicalPlanTupleOperator,
    right: LogicalPlanTupleOperator,
    public on: Calculation,
  ) {
    super(lang, left, right);
    on.parent = this;
  }

  override accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitJoin(this, arg);
  }
  override replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    if (current === this.on) {
      this.on = replacement as Calculation;
    } else {
      super.replaceChild(
        current as LogicalPlanTupleOperator,
        replacement as LogicalPlanTupleOperator,
      );
    }
  }
}
