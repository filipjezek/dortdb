import { Trie } from '../../../data-structures/trie.js';
import { PlanOperator, PlanVisitor } from '../../visitor.js';
import { CalcIntermediate } from './calculation.js';

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
    this.query = replacement;
  }
  getChildren(): PlanOperator[] {
    return [this.query];
  }
}
