import { ASTIdentifier } from '../../../ast.js';
import { LogicalPlanTupleOperator, LogicalPlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class CartesianProduct implements LogicalPlanTupleOperator {
  public schema: ASTIdentifier[];

  constructor(
    public lang: string,
    public left: LogicalPlanTupleOperator,
    public right: LogicalPlanTupleOperator
  ) {
    this.schema = left.schema.concat(right.schema);
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitCartesianProduct(this);
  }
}

export class Join extends CartesianProduct {
  constructor(
    lang: string,
    left: LogicalPlanTupleOperator,
    right: LogicalPlanTupleOperator,
    public on: Calculation
  ) {
    super(lang, left, right);
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitJoin(this);
  }
}

export class LeftOuterJoin extends Join {
  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitLeftOuterJoin(this);
  }
}

export class FullOuterJoin extends Join {
  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitFullOuterJoin(this);
  }
}
