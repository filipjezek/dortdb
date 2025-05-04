import { DortDBAsFriend } from '../db.js';
import { Calculation } from '../plan/operators/index.js';
import { OpOrId } from '../plan/visitor.js';
import { EqualityChecker } from '../visitors/equality-checker.js';
import { Index } from './index.js';

export class MapIndex implements Index {
  expressions: Calculation[];
  private map: Map<unknown, unknown[]> = new Map();
  private eqCheckers: Record<string, EqualityChecker>;

  constructor(expression: Calculation) {
    this.expressions = [expression];
  }

  init(values: Iterable<unknown>, db: DortDBAsFriend): void {
    this.eqCheckers = db.langMgr.getVisitorMap('equalityChecker');
  }

  query(value: unknown): Iterable<unknown> {
    return this.map.get(value) ?? [];
  }

  match(expressions: OpOrId[]): number[] | null {
    const eqChecker = this.eqCheckers[this.expressions[0].lang];
    for (let i = 0; i < expressions.length; i++) {
      if (eqChecker.areEqual(this.expressions[0], expressions[i], true)) {
        return [i];
      }
    }
    return null;
  }
}
