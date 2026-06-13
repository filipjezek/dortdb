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
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { ArgMeta } from '../../../visitors/calculation-builder.js';

/**
 * Container for aggregate calls used in {@link GroupBy}.
 *
 * Wraps a single aggregate function invocation, including its argument expressions
 * and the optional pre-aggregation pipeline (`postGroupOp`) applied to each partition.
 */
export class AggregateCall implements PlanOperator {
  /**
   * Before a partition is piped into the aggregate function,
   * it will be passed through this operator.
   */
  public postGroupOp: PlanTupleOperator;
  /** The leaf {@link TupleSource} at the bottom of {@link postGroupOp}; holds the partition rows. */
  public get postGroupSource(): PlanTupleOperator {
    return this._postGSource;
  }
  /** Backing store for {@link postGroupSource}. */
  protected _postGSource: PlanTupleOperator;
  /** {@inheritDoc PlanOperator.parent} */
  public parent: PlanOperator;
  /** {@inheritDoc PlanOperator.dependencies} */
  public dependencies: IdSet;

  constructor(
    /** {@inheritDoc PlanOperator.lang} */
    public lang: Lowercase<string>,
    /** Argument expressions passed to the aggregate function. */
    public args: (Calculation | ASTIdentifier)[],
    /** Aggregate function implementation. */
    public impl: AggregateFn,
    /** name of this aggregate in its {@link GroupBy} operator */
    public fieldName: ASTIdentifier,
  ) {
    arrSetParent(this.args, this);
    this._postGSource = new TupleSource(
      lang,
      ASTIdentifier.fromParts(['<partition>']),
    );
    this.postGroupOp = this._postGSource;
    this.dependencies = schemaToTrie(args.filter(isId));
    this.fieldName.aggregate = this;
  }

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitAggregate(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    for (let i = 0; i < this.args.length; i++) {
      if (this.args[i] === current) {
        this.args[i] = replacement as Calculation;
        return;
      }
    }
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return this.args.filter(isCalc);
  }

  /**
   * Clone this FnCall
   * @param meta provided by cloned {@link Calculation}, should be modified in-place
   * to reflect new locations of arguments
   */
  clone(meta?: ArgMeta[]): AggregateCall {
    const args = this.args.map(cloneIfPossible);
    const clone = new AggregateCall(
      this.lang,
      args,
      this.impl,
      ASTIdentifier.fromParts(this.fieldName.parts), // so that the `.aggregate` property is correctly set
    );
    const childIndices: number[] = [];
    let origIter = this._postGSource as PlanOperator;
    while (origIter !== this.postGroupOp) {
      const children = origIter.parent.getChildren();
      childIndices.push(children.indexOf(origIter));
      origIter = origIter.parent;
    }

    clone.postGroupOp = this.postGroupOp.clone();
    let cloneIter: PlanOperator = clone.postGroupOp;
    for (let i = childIndices.length - 1; i >= 0; i--) {
      cloneIter = cloneIter.getChildren()[childIndices[i]];
    }
    clone._postGSource = cloneIter as TupleSource;

    for (const m of meta ?? []) {
      if (m.aggregate === this) m.aggregate = clone;
    }
    return clone;
  }
}
