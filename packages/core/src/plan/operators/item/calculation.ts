import { ASTIdentifier } from '../../../ast.js';
import { clone, cloneIfPossible, isId } from '../../../internal-fns/index.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { schemaToTrie } from '../../../utils/trie.js';
import {
  ArgMeta,
  CalculationParams,
} from '../../../visitors/calculation-builder.js';
import { IdSet, OpOrId, PlanOperator, PlanVisitor } from '../../visitor.js';
import { AggregateCall } from './aggregate-call.js';
import { clone as _clone } from 'lodash-es';
import { intermediateToCalc } from '../../../utils/calculation.js';
import { EqualityChecker } from '../../../visitors/equality-checker.js';

/**
 * This property identifies plan operators which are intermediate steps for {@link Calculation}
 */
export const CalcIntermediate = Symbol('CalcIntermediate');

/**
 * Built from literals, fncalls etc.
 */
export class Calculation implements PlanOperator {
  public parent: PlanOperator;
  public dependencies: IdSet;

  protected cachedITCVisitors: {
    calcBuilders: Record<string, PlanVisitor<CalculationParams>>;
    eqCheckers: Record<string, EqualityChecker>;
  } = null;

  constructor(
    public lang: Lowercase<string>,
    public impl: (...args: any[]) => any,
    /** args which are plan operators will be instantiated as arrays during execution */
    public args: OpOrId[],
    public argMeta: ArgMeta[],
    public original?: PlanOperator,
    public aggregates: AggregateCall[] = [],
    public literal = false,
  ) {
    arrSetParent(args, this);
    arrSetParent(aggregates, this);
    this.dependencies = schemaToTrie(this.args.filter(isId));
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitCalculation(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    let idx: number;
    if (current instanceof AggregateCall) {
      idx = this.aggregates.indexOf(current);
      this.aggregates[idx] = replacement as AggregateCall;
      idx = this.argMeta.findIndex((m) => m.aggregate === current);
      this.argMeta[idx].aggregate = replacement as AggregateCall;
    } else {
      idx = this.args.indexOf(current);
      this.args[idx] = replacement;
    }
    if (current === this.original) {
      this.original = replacement;
    } else {
      const locs = this.argMeta[idx].originalLocations;
      if (!locs.length) return; // the calculation was created from a single PlanOperator which was not a CalcIntermediate
      locs[0].obj[locs[0].key] = replacement;
      for (let i = 1; i < locs.length; i++) {
        locs[i].obj[locs[i].key] = replacement.clone();
      }
    }
  }
  getChildren(): PlanOperator[] {
    const res: PlanOperator[] = [];
    for (const arg of this.args) {
      if (!(arg instanceof ASTIdentifier)) {
        res.push(arg);
      }
    }
    return res;
  }

  /**
   * Called by {@link intermediateToCalc} to cache visitors for future cloning.
   */
  cacheITCVisitors(
    calcBuilders: Record<string, PlanVisitor<CalculationParams>>,
    eqCheckers: Record<string, EqualityChecker>,
  ) {
    this.cachedITCVisitors = { calcBuilders, eqCheckers };
  }

  /**
   * In order to clone a calculation properly, it may need to call {@link intermediateToCalc}. In that case, it will use the
   * cached versions of calcBuilder and eqCheckers provided.
   */
  clone(): Calculation {
    if (this.cachedITCVisitors) {
      return intermediateToCalc(
        this.original.clone(),
        this.cachedITCVisitors.calcBuilders,
        this.cachedITCVisitors.eqCheckers,
      );
    }

    const res = new Calculation(
      this.lang,
      this.impl,
      this.args.map(cloneIfPossible),
      _clone(this.argMeta),
      this.original?.clone(),
      this.aggregates.map(clone),
      this.literal,
    );
    return res;
  }
}
