import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';

export abstract class SetOperator extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public left: LogicalPlanOperator,
    public right: LogicalPlanOperator,
  ) {
    super();
    this.lang = lang;
    if (
      left instanceof LogicalPlanTupleOperator !==
      right instanceof LogicalPlanTupleOperator
    ) {
      throw new Error(
        'Both sides of a set operator must be either tuple or non-tuple operators',
      );
    }
    if (left instanceof LogicalPlanTupleOperator) {
      this.schema = left.schema;
      this.schemaSet = left.schemaSet;
    }
    left.parent = this;
    right.parent = this;
  }

  abstract override accept<T>(
    visitors: Record<string, LogicalPlanVisitor<T>>,
  ): T;
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    if (this.left === current) {
      this.left = replacement;
    } else {
      this.right = replacement;
    }
  }
  getChildren(): LogicalPlanOperator[] {
    return [this.left, this.right];
  }
}

export class Union extends SetOperator {
  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitUnion(this, arg);
  }
}

export class Intersection extends SetOperator {
  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitIntersection(this, arg);
  }
}

export class Difference extends SetOperator {
  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitDifference(this, arg);
  }
}
