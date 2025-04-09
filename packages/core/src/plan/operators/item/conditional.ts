import { ASTIdentifier } from '../../../ast.js';
import {
  IdSet,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { CalcIntermediate } from './calculation.js';

export class Conditional implements LogicalPlanOperator {
  public [CalcIntermediate] = true;
  public dependencies: IdSet;

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
  getChildren(): LogicalPlanOperator[] {
    return [this.condition, ...this.whenThens.flat(), this.defaultCase].filter(
      (ch) => ch && !(ch instanceof ASTIdentifier),
    ) as LogicalPlanOperator[];
  }
}
