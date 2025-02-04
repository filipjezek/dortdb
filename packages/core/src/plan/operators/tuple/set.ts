import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';

export abstract class SetOperator extends LogicalPlanTupleOperator {
  constructor(
    public lang: Lowercase<string>,
    public left: LogicalPlanOperator,
    public right: LogicalPlanOperator
  ) {
    super();
    if (
      left instanceof LogicalPlanTupleOperator !==
      right instanceof LogicalPlanTupleOperator
    ) {
      throw new Error(
        'Both sides of a set operator must be either tuple or non-tuple operators'
      );
    }
    if (left instanceof LogicalPlanTupleOperator) {
      this.schema = left.schema;
      this.schemaSet = left.schemaSet;
    }
  }

  abstract accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T;
}

export class Union extends SetOperator {
  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitUnion(this);
  }
}

export class Intersection extends SetOperator {
  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitIntersection(this);
  }
}

export class Difference extends SetOperator {
  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitDifference(this);
  }
}
