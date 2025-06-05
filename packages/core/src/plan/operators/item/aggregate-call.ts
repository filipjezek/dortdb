import { Trie } from '../../../data-structures/trie.js';
import { ASTIdentifier } from '../../../ast.js';
import { AggregateFn } from '../../../extension.js';
import {
  IdSet,
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../../visitor.js';
import { TupleSource } from '../tuple/tuple-source.js';
import { Calculation } from './calculation.js';
import { GroupBy } from '../tuple/groupby.js';
import { cloneIfPossible, isCalc, isId } from '../../../internal-fns/index.js';
import { schemaToTrie } from '../../../utils/trie.js';

/**
 * Container for aggregate calls used in {@link GroupBy}
 */
export class AggregateCall implements PlanOperator {
  /**
   * Before a partition is piped into the aggregate function,
   * it will be passed through this operator.
   */
  public postGroupOp: PlanTupleOperator;
  public get postGroupSource(): PlanTupleOperator {
    return this._postGSource;
  }
  private _postGSource: PlanTupleOperator;
  public parent: Calculation;
  public dependencies: IdSet;

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
    this.dependencies = schemaToTrie(args.filter(isId));
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitAggregate(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    for (let i = 0; i < this.args.length; i++) {
      if (this.args[i] === current) {
        this.args[i] = replacement as Calculation;
        return;
      }
    }
  }
  getChildren(): PlanOperator[] {
    return this.args.filter(isCalc);
  }
  clone(): AggregateCall {
    const args = this.args.map(cloneIfPossible);
    const clone = new AggregateCall(this.lang, args, this.impl, this.fieldName);
    clone.postGroupOp = this.postGroupOp.clone();
    return clone;
  }
}
