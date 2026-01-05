import { Trie } from '../../../data-structures/trie.js';
import { ArgMeta } from '../../../visitors/calculation-builder.js';
import { PlanOperator, PlanVisitor } from '../../visitor.js';
import { CalcIntermediate, Calculation } from './calculation.js';

export enum QuantifierType {
  ALL = 'all',
  ANY = 'any',
}
export class Quantifier implements PlanOperator {
  public [CalcIntermediate] = true;
  public dependencies = new Trie<string | symbol>();

  constructor(
    public lang: Lowercase<string>,
    public type: QuantifierType,
    public query: PlanOperator,
  ) {}

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitQuantifier(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    this.query = replacement;
  }
  getChildren(): PlanOperator[] {
    return [this.query];
  }

  /**
   * Clone this FnCall
   * @param meta provided by cloned {@link Calculation}, should be modified in-place
   * to reflect new locations of arguments
   */
  clone(meta?: ArgMeta[]): Quantifier {
    const res = new Quantifier(this.lang, this.type, this.query.clone());

    for (const m of meta ?? []) {
      for (const loc of m.originalLocations) {
        if (loc.op === this) loc.op = res;
        else continue;
        if (loc.obj === this) loc.obj = res;
      }
    }
    return res;
  }
}
