import { ASTIdentifier } from '../../../ast.js';
import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';

export class Limit implements LogicalPlanTupleOperator {
  public schema: ASTIdentifier[];

  constructor(
    public lang: string,
    public skip: number,
    public limit: number,
    public source: LogicalPlanOperator
  ) {
    this.schema = (source as LogicalPlanTupleOperator).schema;
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitLimit(this);
  }
}
