import { ASTIdentifier } from '../../ast.js';
import { LogicalPlanOperator, LogicalPlanVisitor } from '../visitor.js';

export class MapToItem implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public key: ASTIdentifier,
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitMapToItem(this);
  }
}

export class MapFromItem implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public key: ASTIdentifier,
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitMapFromItem(this);
  }
}
