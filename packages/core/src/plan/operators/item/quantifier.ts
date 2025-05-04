import { IdSet, PlanOperator, PlanVisitor } from '../../visitor.js';
import { CalcIntermediate } from './calculation.js';

export enum QuantifierType {
  ALL = 'all',
  ANY = 'any',
}
export class Quantifier implements PlanOperator {
  public [CalcIntermediate] = true;
  public dependencies: IdSet;

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
    throw new Error('Method not implemented.');
  }
  getChildren(): PlanOperator[] {
    return [this.query];
  }
}
