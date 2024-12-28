import { ASTIdentifier } from '../../../ast.js';
import {
  Aliased,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class Projection implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public attrs: Aliased<ASTIdentifier | Calculation>[],
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjection(this);
  }
}

/**
 * dependent join
 */
export class ProjectionConcat implements LogicalPlanOperator {
  constructor(
    public lang: string,
    /** mapping must be interpreted in the context of the source */
    public mapping: LogicalPlanOperator,
    public outer: boolean,
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjectionConcat(this);
  }
}

export class ProjectionIndex implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public indexCol: ASTIdentifier,
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjectionIndex(this);
  }
}
