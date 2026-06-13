import { Trie } from '../../data-structures/trie.js';
import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../visitor.js';

/**
 * A leaf operator that emits exactly one empty row with no attributes.
 *
 * Used as the source for queries that have no FROM clause (e.g. `SELECT 1`).
 */
export class NullSource extends PlanTupleOperator {
  constructor(lang: Lowercase<string>) {
    super();
    this.lang = lang;
    this.schema = [];
    this.schemaSet = new Trie<string | symbol>();
  }

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitNullSource(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    throw new Error('Method not implemented.');
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return [];
  }
  /** {@inheritDoc PlanOperator.clone} */
  clone(): NullSource {
    const clone = new NullSource(this.lang);
    return clone;
  }
}
