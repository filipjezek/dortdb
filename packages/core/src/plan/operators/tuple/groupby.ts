import { ASTIdentifier } from '../../../ast.js';
import {
  Aliased,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { AggregateCall } from '../item/aggregate-call.js';
import { Calculation } from '../item/calculation.js';

export class GroupBy implements LogicalPlanTupleOperator {
  public schema: ASTIdentifier[];

  constructor(
    public lang: string,
    public keys: Aliased<ASTIdentifier | Calculation>[],
    public aggs: AggregateCall[],
    public source: LogicalPlanTupleOperator
  ) {
    this.schema = keys.map((k) => k[1]).concat(aggs.map((a) => a.fieldName));
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitGroupBy(this);
  }
}
