import { ASTIdentifier } from '../../../ast.js';
import { LogicalPlanOperator, LogicalPlanVisitor } from '../../visitor.js';

export class FnCall implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public name: ASTIdentifier,
    public args: (ASTIdentifier | LogicalPlanOperator)[]
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitFnCall(this);
  }
}
