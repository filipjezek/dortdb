import { DortDBAsFriend } from '../db.js';
import { eq } from '../operators/relational.js';
import { Calculation, RenameMap } from '../plan/operators/index.js';
import { EqualityChecker } from '../visitors/equality-checker.js';
import { Index, IndexMatchInput } from './index.js';

export class MapIndex implements Index {
  private map: Map<unknown, unknown[]> = new Map();
  private eqCheckers: Record<string, EqualityChecker>;

  constructor(
    public expressions: Calculation[],
    db: DortDBAsFriend,
  ) {
    if (expressions.length !== 1) {
      throw new Error('MapIndex only supports one expression');
    }
    this.eqCheckers = db.langMgr.getVisitorMap('equalityChecker');
  }

  reindex(values: Iterable<unknown>): void {}

  query(value: unknown): Iterable<unknown> {
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
}
