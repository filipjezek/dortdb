import { Trie } from '../../../data-structures/trie.js';
import { ASTIdentifier } from '../../../ast.js';
import { AggregateFn } from '../../../extension.js';
import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { TupleSource } from '../tuple/tuple-source.js';
import { Calculation } from './calculation.js';
import { GroupBy } from '../tuple/groupby.js';
import { isCalc } from '../../../internal-fns/index.js';

/**
 * Container for aggregate calls used in {@link GroupBy}
 */
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
  public parent: Calculation;

  constructor(
    public lang: Lowercase<string>,
    public args: (Calculation | ASTIdentifier)[],
    public impl: AggregateFn,
    /** name of this aggregate in its {@link GroupBy} operator */
    public fieldName: ASTIdentifier,
  ) {
    this._postGSource = new TupleSource(
      lang,
      ASTIdentifier.fromParts(['<partition>']),
    );
    this._postGSource.schema = [];
    this._postGSource.schemaSet = new Trie<string | symbol>();
    this.postGroupOp = this._postGSource;
  }

  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitAggregate(this, arg);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    throw new Error('Method not implemented.');
  }
  getChildren(): LogicalPlanOperator[] {
    return this.args.filter(isCalc);
  }
}
