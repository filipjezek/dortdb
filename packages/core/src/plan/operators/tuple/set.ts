import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../../visitor.js';

export abstract class SetOperator extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public left: PlanOperator,
    public right: PlanOperator,
  ) {
    super();
    this.lang = lang;
    if (
      left instanceof PlanTupleOperator !==
      right instanceof PlanTupleOperator
    ) {
      throw new Error(
        'Both sides of a set operator must be either tuple or non-tuple operators',
      );
    }
    if (left instanceof PlanTupleOperator) {
      this.schema = left.schema;
      this.schemaSet = left.schemaSet;
    }
    left.parent = this;
    right.parent = this;
  }

  abstract override accept<T>(visitors: Record<string, PlanVisitor<T>>): T;
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    if (this.left === current) {
      this.left = replacement;
    } else {
      this.right = replacement;
    }
  }
  getChildren(): PlanOperator[] {
    return [this.left, this.right];
  }
}

export class Union extends SetOperator {
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitUnion(this, arg);
  }
  clone(): Union {
    return new Union(this.lang, this.left.clone(), this.right.clone());
  }
}

export class Intersection extends SetOperator {
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitIntersection(this, arg);
  }
  clone(): Intersection {
    return new Intersection(this.lang, this.left.clone(), this.right.clone());
  }
}

export class Difference extends SetOperator {
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitDifference(this, arg);
  }
  clone(): Difference {
    return new Difference(this.lang, this.left.clone(), this.right.clone());
  }
}
