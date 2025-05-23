import { DortDBAsFriend } from '../db.js';
import { eq } from '../operators/relational.js';
import { Calculation, FnCall, RenameMap } from '../plan/operators/index.js';
import { PlanVisitor } from '../plan/visitor.js';
import {
  CalculationParams,
  simplifyCalcParams,
} from '../visitors/calculation-builder.js';
import { EqualityChecker } from '../visitors/equality-checker.js';
import { EqIndexAccessor, Index, IndexMatchInput } from './index.js';

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

  reindex(values: Iterable<unknown>): void {}

  query({ value }: { value: unknown }): Iterable<unknown> {
    return this.map.get(value) ?? [];
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
      (a) =>
        a !==
        ('op' in expressions[0].expr
          ? expressions[0].expr.op
          : expressions[0].expr),
    );
    const accessorFnCall = new FnCall(eqFn.lang, [otherArg], (value) => ({
      value,
    }));
    let calcParams = accessorFnCall.accept(this.calcBuilders);
    calcParams = simplifyCalcParams(calcParams, this.eqCheckers, eqFn.lang);
    return new Calculation(
      eqFn.lang,
      calcParams.impl,
      calcParams.args,
      calcParams.argMeta,
      accessorFnCall,
      calcParams.aggregates,
      calcParams.literal,
    );
  }
}
