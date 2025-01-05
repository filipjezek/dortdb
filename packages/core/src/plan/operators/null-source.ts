import { ASTIdentifier } from '../../ast.js';
import { LogicalPlanTupleOperator, LogicalPlanVisitor } from '../visitor.js';

export class NullSource implements LogicalPlanTupleOperator {
  public schema: ASTIdentifier[] = null;

  constructor(public lang: string) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitNullSource(this);
  }
}
