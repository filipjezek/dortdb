import { ASTIdentifier } from '../../../ast.js';
import { LogicalPlanTupleOperator, LogicalPlanVisitor } from '../../visitor.js';

export abstract class SetOperator implements LogicalPlanTupleOperator {
  public schema: ASTIdentifier[];

  constructor(
    public lang: string,
    public left: LogicalPlanTupleOperator,
    public right: LogicalPlanTupleOperator
  ) {
    this.schema = left.schema;
  }

  abstract accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T;
}

export class Union extends SetOperator {
  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitUnion(this);
  }
}

export class UnionAll extends SetOperator {
  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitUnionAll(this);
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
