import { ASTIdentifier } from '../../../ast.js';
import { IdSet, PlanOperator, PlanVisitor } from '../../visitor.js';
import { CalcIntermediate } from './calculation.js';

export class Conditional implements PlanOperator {
  public [CalcIntermediate] = true;
  public dependencies: IdSet;

  constructor(
    public lang: Lowercase<string>,
    public condition: PlanOperator | ASTIdentifier,
    public whenThens: [
      PlanOperator | ASTIdentifier,
      PlanOperator | ASTIdentifier,
    ][],
    public defaultCase: PlanOperator | ASTIdentifier,
  ) {}

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitConditional(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    throw new Error('Method not implemented.');
  }
  getChildren(): PlanOperator[] {
    return [this.condition, ...this.whenThens.flat(), this.defaultCase].filter(
      (ch) => ch && !(ch instanceof ASTIdentifier),
    ) as PlanOperator[];
  }
}
