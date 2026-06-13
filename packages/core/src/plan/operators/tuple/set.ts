import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../../visitor.js';

/**
 * Abstract base for binary set operations (union, intersection, difference) on two operator streams.
 *
 * Both `left` and `right` must be of the same kind (both tuple or both non-tuple);
 * the schema is taken from `left`.
 * @throws {Error} if one side is a tuple operator and the other is not.
 */
export abstract class SetOperator extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** Left input stream. */
    public left: PlanOperator,
    /** Right input stream. */
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

  /** {@inheritDoc PlanOperator.accept} */
  abstract override accept<T>(visitors: Record<string, PlanVisitor<T>>): T;
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    if (this.left === current) {
      this.left = replacement;
    } else {
      this.right = replacement;
    }
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return [this.left, this.right];
  }
}

/** Emits all rows from `left` followed by all rows from `right`, including duplicates. */
export class Union extends SetOperator {
  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitUnion(this, arg);
  }
  /** {@inheritDoc PlanOperator.clone} */
  clone(): Union {
    return new Union(this.lang, this.left.clone(), this.right.clone());
  }
}

/** Emits only rows that appear in both `left` and `right`. */
export class Intersection extends SetOperator {
  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitIntersection(this, arg);
  }
  /** {@inheritDoc PlanOperator.clone} */
  clone(): Intersection {
    return new Intersection(this.lang, this.left.clone(), this.right.clone());
  }
}

/** Emits rows from `left` that do not appear in `right`. */
export class Difference extends SetOperator {
  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitDifference(this, arg);
  }
  /** {@inheritDoc PlanOperator.clone} */
  clone(): Difference {
    return new Difference(this.lang, this.left.clone(), this.right.clone());
  }
}
