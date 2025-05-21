import { Trie } from '../../../data-structures/trie.js';
import { PlanOperator, PlanVisitor } from '../../visitor.js';
import { CalcIntermediate } from './calculation.js';

export class Literal<T = unknown> implements PlanOperator {
  public [CalcIntermediate] = true;
  public dependencies = new Trie<string | symbol>();

  constructor(
    public lang: Lowercase<string>,
    public value: T,
  ) {}

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitLiteral(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    throw new Error('Method not implemented.');
  }
  getChildren(): PlanOperator[] {
    return [];
  }
  clone(): Literal<T> {
    return new Literal(this.lang, this.value);
  }
}
