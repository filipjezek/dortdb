import { ASTIdentifier } from '../../../ast.js';
import { LogicalPlanOperator, LogicalPlanVisitor } from '../../visitor.js';

export interface PlanOpAsArg {
  op: LogicalPlanOperator;
  acceptSequence?: boolean;
}

export class FnCall implements LogicalPlanOperator {
  constructor(
    public lang: Lowercase<string>,
    public args: (ASTIdentifier | PlanOpAsArg)[],
    public impl: (...args: any[]) => any,
    /**
     * Function is pure if it has no side effects and always returns the same output for the same input.
     * This means that a function creating a new object every time it is called is not pure.
     */
    public pure = false
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitFnCall(this);
  }
}
