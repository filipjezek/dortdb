import { ASTIdentifier } from '../../../ast.js';
import { LogicalPlanOperator, LogicalPlanVisitor } from '../../visitor.js';
import { CalcIntermediate } from './calculation.js';

export class Conditional implements LogicalPlanOperator {
  public [CalcIntermediate] = true;

  constructor(
    public lang: Lowercase<string>,
    public condition: LogicalPlanOperator | ASTIdentifier,
    public whenThens: [
      LogicalPlanOperator | ASTIdentifier,
      LogicalPlanOperator | ASTIdentifier,
    ][],
    public defaultCase: LogicalPlanOperator | ASTIdentifier,
  ) {}

  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitConditional(this, arg);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    throw new Error('Method not implemented.');
  }
}
