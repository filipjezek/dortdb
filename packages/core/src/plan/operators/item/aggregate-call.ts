import { ASTIdentifier } from '../../../ast.js';
import { AggregateFn } from '../../../extension.js';
import {
  LogicalOpOrId,
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { TupleSource } from '../tuple/tuple-source.js';
import { Calculation } from './calculation.js';

export class AggregateCall implements LogicalPlanOperator {
  /**
   * Before a partition is piped into the aggregate function,
   * it will be passed through this operator.
   */
  public postGroupOp: LogicalPlanTupleOperator;
  public get postGroupSource(): LogicalPlanTupleOperator {
    return this._postGSource;
  }
  private _postGSource: LogicalPlanTupleOperator;

  constructor(
    public lang: string,
    public args: (Calculation | ASTIdentifier)[],
    public impl: AggregateFn,
    /** name of this aggregate in its {@link GroupBy} operator */
    public fieldName: ASTIdentifier
  ) {
    this._postGSource = new TupleSource(
      lang,
      ASTIdentifier.fromParts(['<partition>'])
    );
    this._postGSource.schema = [];
    this.postGroupOp = this._postGSource;
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitAggregate(this);
  }
}
