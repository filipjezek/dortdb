import { DortDBAsFriend } from '../db.js';
import { eq, isOp } from '../operators/relational.js';
import { Calculation, FnCall, RenameMap } from '../plan/operators/index.js';
import { PlanVisitor } from '../plan/visitor.js';
import { intermediateToCalc } from '../utils/calculation.js';
import { CalculationParams } from '../visitors/calculation-builder.js';
import { EqualityChecker } from '../visitors/equality-checker.js';
import { HashJoinIndex, IndexFillInput, IndexMatchInput } from './index.js';

/**
 * A simple secondary index based on JavaScript Maps.
 */
export class MapIndex implements HashJoinIndex {
  /** Backing store: normalized key → list of source values. */
  protected map: Map<unknown, unknown[]> = new Map();
  /** Per-language {@link EqualityChecker} visitors used to compare index expressions structurally. */
  protected eqCheckers: Record<string, EqualityChecker>;
  /** Per-language calculation-builder visitors used to compile plan operators into {@link Calculation} instances. */
  protected calcBuilders: Record<string, PlanVisitor<CalculationParams>>;

  constructor(
    public expressions: Calculation[],
    db: DortDBAsFriend,
  ) {
    if (expressions.length !== 1) {
      throw new Error('MapIndex only supports one expression');
    }
    this.eqCheckers = db.langMgr.getVisitorMap('equalityChecker');
    this.calcBuilders = db.langMgr.getVisitorMap('calculationBuilder');
  }

  reindex(values: Iterable<IndexFillInput>): void {
    this.map.clear();
    for (const { keys, value } of values) {
      let [key] = keys;
      key = this.normalizeKey(key);
      let keyVals = this.map.get(key);
      if (!keyVals) {
        keyVals = [];
        this.map.set(key, keyVals);
      }
      keyVals.push(value);
    }
  }

  match(
    expressions: IndexMatchInput[],
    renameMap?: RenameMap,
  ): number[] | null {
    const eqChecker = this.eqCheckers[this.expressions[0].lang];
    for (let i = 0; i < expressions.length; i++) {
      const fn = expressions[i].containingFn.impl;
      if (
        (fn === eq.impl || fn === isOp.impl) &&
        eqChecker.areEqual(this.expressions[0].original, expressions[i].expr, {
          ignoreLang: true,
          renameMap,
        })
      ) {
        return [i];
      }
    }
    return null;
  }

  /** Returns the index of the first equality expression that this index type can handle, or `null` if none qualify. */
  static canIndex(expressions: IndexMatchInput[]): number[] | null {
    const i = expressions.findIndex(
      (e) =>
        e.containingFn.impl === eq.impl || e.containingFn.impl === isOp.impl,
    );
    return i === -1 ? null : [i];
  }

  /** The default equality comparison is not strict. This method returns alternative values that are considered equal. */
  protected getAlternatives(value: unknown): unknown[] {
    const alternatives = [value];
    if (typeof value !== 'string' && typeof value !== 'object') {
      alternatives.push(value.toString());
    } else {
      const numValue = +value;
      if (!isNaN(numValue)) {
        alternatives.push(numValue);
      }
    }
    if (value === '1' || value === 1 || value === 'true') {
      alternatives.push(true);
    } else if (value === '0' || value === 0 || value === 'false') {
      alternatives.push(false);
    } else if (value === true) {
      alternatives.push(1);
    } else if (value === false) {
      alternatives.push(0);
    }

    return alternatives;
  }

  /** Normalizes a key before storage or lookup; maps `undefined` to `null`. */
  protected normalizeKey(value: unknown): unknown {
    if (value === undefined) return null;
    return value;
  }

  createAccessor(expressions: IndexMatchInput[]): Calculation {
    const eqFn = expressions[0].containingFn;
    const otherArg = eqFn.args.find(
      (a) => expressions[0].expr !== ('op' in a ? a.op : a),
    );
    const accessorFnCall = new FnCall(
      eqFn.lang,
      [otherArg],
      eqFn.impl === eq.impl
        ? (value) =>
            this.getAlternatives(this.normalizeKey(value)).flatMap(
              (v) => this.map.get(v) ?? [],
            )
        : (value) => this.map.get(this.normalizeKey(value)) ?? [],
    );
    return intermediateToCalc(
      accessorFnCall,
      this.calcBuilders,
      this.eqCheckers,
    );
  }

  *allValues(): Iterable<unknown[]> {
    for (const values of this.map.values()) {
      yield* values as unknown[][];
    }
  }
}
