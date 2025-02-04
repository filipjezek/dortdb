import { ASTIdentifier } from '../../ast.js';
import { LogicalPlanTupleOperator, LogicalPlanVisitor } from '../visitor.js';

export class NullSource extends LogicalPlanTupleOperator {
  public schema: ASTIdentifier[] = null;

  constructor(public lang: Lowercase<string>) {
    super();
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitNullSource(this);
  }
}
