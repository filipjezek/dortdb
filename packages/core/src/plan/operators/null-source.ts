import { Trie } from '../../data-structures/trie.js';
import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../visitor.js';

export class NullSource extends PlanTupleOperator {
  constructor(lang: Lowercase<string>) {
    super();
    this.lang = lang;
    this.schema = [];
    this.schemaSet = new Trie<string | symbol>();
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitNullSource(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    throw new Error('Method not implemented.');
  }
  getChildren(): PlanOperator[] {
    return [];
  }
  clone(): NullSource {
    const clone = new NullSource(this.lang);
    return clone;
  }
}
