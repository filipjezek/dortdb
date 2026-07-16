import { Trie } from '../../../data-structures/trie.js';
import { ArgMeta } from '../../../visitors/calculation-builder.js';
import { PlanOperator, PlanVisitor } from '../../visitor.js';
import { CalcIntermediate, Calculation } from './calculation.js';

/** Selects whether ALL or ANY rows in a subquery must satisfy a condition. */
export enum QuantifierType {
  /** The condition must hold for every row in the subquery. */
  ALL = 'all',
  /** The condition must hold for at least one row in the subquery. */
  ANY = 'any',
}

/** Wraps a subquery with an ALL or ANY quantifier for use in a comparison expression. */
export class Quantifier implements PlanOperator {
  /** Marks this as a {@link CalcIntermediate} sub-operator of a {@link Calculation}. */
  public [CalcIntermediate] = true;
  /** {@inheritDoc PlanOperator.dependencies} */
  public dependencies = new Trie<string | symbol>();

  constructor(
    /** {@inheritDoc PlanOperator.lang} */
    public lang: Lowercase<string>,
    /** Whether the quantification is ALL or ANY. */
    public type: QuantifierType,
    /** The subquery operator whose rows are quantified. */
    public query: PlanOperator,
  ) {
    this.query.parent = this;
  }

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitQuantifier(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    this.query = replacement;
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return [this.query];
  }

  /**
   * Clone this Quantifier
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
