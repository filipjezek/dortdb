import { Trie } from '../../../data-structures/trie.js';
import { ArgMeta } from '../../../visitors/calculation-builder.js';
import { PlanOperator, PlanVisitor } from '../../visitor.js';
import { CalcIntermediate, Calculation } from './calculation.js';

/** A compile-time constant value embedded in a {@link Calculation}. */
export class Literal<T = unknown> implements PlanOperator {
  /** Marks this as a {@link CalcIntermediate} sub-operator of a {@link Calculation}. */
  public [CalcIntermediate] = true;
  /** {@inheritDoc PlanOperator.dependencies} */
  public dependencies = new Trie<string | symbol>();

  constructor(
    /** {@inheritDoc PlanOperator.lang} */
    public lang: Lowercase<string>,
    /** The constant value produced by this literal. */
    public value: T,
  ) {}

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitLiteral(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    throw new Error('Method not implemented.');
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return [];
  }

  /**
   * Clone this FnCall
   * @param meta provided by cloned {@link Calculation}, should be modified in-place
   * to reflect new locations of arguments
   */
  clone(meta?: ArgMeta[]): Literal<T> {
    return new Literal(this.lang, this.value);
  }
}
