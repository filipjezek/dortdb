import { DortDBAsFriend } from '../db.js';
import { eq } from '../operators/relational.js';
import { Calculation, FnCall, RenameMap } from '../plan/operators/index.js';
import { PlanVisitor } from '../plan/visitor.js';
import { intermediateToCalc } from '../utils/calculation.js';
import { CalculationParams } from '../visitors/calculation-builder.js';
import { EqualityChecker } from '../visitors/equality-checker.js';
import { Index, IndexFillInput, IndexMatchInput } from './index.js';

export class MapIndex implements Index {
  protected map: Map<unknown, unknown[]> = new Map();
  protected eqCheckers: Record<string, EqualityChecker>;
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
    for (const {
      keys: [key],
      value,
    } of values) {
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
      if (
        expressions[i].containingFn.impl === eq.impl &&
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

  createAccessor(expressions: IndexMatchInput[]): Calculation {
    const eqFn = expressions[0].containingFn;
    const otherArg = eqFn.args.find(
      (a) => expressions[0].expr !== ('op' in a ? a.op : a),
    );
    const accessorFnCall = new FnCall(
      eqFn.lang,
      [otherArg],
      (value) => this.map.get(value) ?? [],
    );
    return intermediateToCalc(
      accessorFnCall,
      this.calcBuilders,
      this.eqCheckers,
    );
  }
}
