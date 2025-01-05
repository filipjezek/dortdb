import { ASTIdentifier } from '../../../ast.js';
import {
  Aliased,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class Projection implements LogicalPlanTupleOperator {
  public schema: ASTIdentifier[];

  constructor(
    public lang: string,
    public attrs: Aliased<ASTIdentifier | Calculation>[],
    public source: LogicalPlanTupleOperator
  ) {
    this.schema = attrs.map((a) => a[1]);
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjection(this);
  }
}

/**
 * dependent join
 */
export class ProjectionConcat implements LogicalPlanTupleOperator {
  public schema: ASTIdentifier[];

  constructor(
    public lang: string,
    /** mapping must be interpreted in the context of the source */
    public mapping: LogicalPlanTupleOperator,
    public outer: boolean,
    public source: LogicalPlanTupleOperator
  ) {
    this.schema = source.schema.concat(mapping.schema);
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjectionConcat(this);
  }
}

export class ProjectionIndex implements LogicalPlanTupleOperator {
  public schema: ASTIdentifier[];

  constructor(
    public lang: string,
    public indexCol: ASTIdentifier,
    public source: LogicalPlanTupleOperator
  ) {
    this.schema = [...source.schema, indexCol];
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjectionIndex(this);
  }
}
