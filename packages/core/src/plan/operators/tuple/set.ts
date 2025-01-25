import { LogicalPlanTupleOperator, LogicalPlanVisitor } from '../../visitor.js';

export abstract class SetOperator extends LogicalPlanTupleOperator {
  constructor(
    public lang: string,
    public left: LogicalPlanTupleOperator,
    public right: LogicalPlanTupleOperator
  ) {
    super();
    this.schema = left.schema;
    this.schemaSet = left.schemaSet;
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
