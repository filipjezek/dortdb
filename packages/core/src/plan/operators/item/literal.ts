import { LogicalPlanOperator, LogicalPlanVisitor } from '../../visitor.js';
import { CalcIntermediate } from './calculation.js';

export class Literal<T = unknown> implements LogicalPlanOperator {
  public [CalcIntermediate] = true;

  constructor(
    public lang: Lowercase<string>,
    public value: T,
  ) {}

  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitLiteral(this, arg);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    throw new Error('Method not implemented.');
  }
}
