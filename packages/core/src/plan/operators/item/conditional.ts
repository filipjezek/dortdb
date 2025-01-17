import { ASTIdentifier } from '../../../ast.js';
import { LogicalPlanOperator, LogicalPlanVisitor } from '../../visitor.js';

export class Conditional implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public condition: LogicalPlanOperator | ASTIdentifier,
    public whenThens: [
      LogicalPlanOperator | ASTIdentifier,
      LogicalPlanOperator | ASTIdentifier
    ][],
    public defaultCase: LogicalPlanOperator | ASTIdentifier
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitConditional(this);
  }
}
