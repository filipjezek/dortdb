import { ASTIdentifier } from '../../../ast.js';
import {
  IdSet,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { CalcIntermediate } from './calculation.js';

export interface PlanOpAsArg {
  op: LogicalPlanOperator;
  /** can the subquery return more than one value?
   * if true, the subquery will be converted to an array of values
   */
  acceptSequence?: boolean;
}

export class FnCall implements LogicalPlanOperator {
  public [CalcIntermediate] = true;
  public dependencies: IdSet;

  constructor(
    public lang: Lowercase<string>,
    public args: (ASTIdentifier | PlanOpAsArg)[],
    public impl: (...args: any[]) => any,
    /**
     * Function is pure if it has no side effects and always returns the same output for the same input.
     * This means that `() => ({})` is not pure.
     */
    public pure = false,
  ) {}

  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitFnCall(this, arg);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    throw new Error('Method not implemented.');
  }
  getChildren(): LogicalPlanOperator[] {
    const res: LogicalPlanOperator[] = [];
    for (const arg of this.args) {
      if ('op' in arg) {
        res.push(arg.op);
      }
    }
    return res;
  }
}
