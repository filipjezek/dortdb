import { LogicalPlanOperator, LogicalPlanVisitor } from '../../visitor.js';

export class Literal implements LogicalPlanOperator {
  constructor(
    public lang: Lowercase<string>,
    public value: any,
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
