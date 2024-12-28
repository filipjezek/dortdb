import { LogicalPlanOperator, LogicalPlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class CartesianProduct implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public left: LogicalPlanOperator,
    public right: LogicalPlanOperator
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitCartesianProduct(this);
  }
}

export class Join implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public left: LogicalPlanOperator,
    public right: LogicalPlanOperator,
    public on: Calculation
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitJoin(this);
  }
}

export class LeftOuterJoin implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public left: LogicalPlanOperator,
    public right: LogicalPlanOperator,
    public on: Calculation
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitLeftOuterJoin(this);
  }
}

export class FullOuterJoin implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public left: LogicalPlanOperator,
    public right: LogicalPlanOperator,
    public on: Calculation
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitFullOuterJoin(this);
  }
}
