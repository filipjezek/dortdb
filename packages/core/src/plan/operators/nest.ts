import { ASTIdentifier } from '../../ast.js';
import { LogicalPlanOperator, LogicalPlanVisitor } from '../visitor.js';

export class Nest implements LogicalPlanOperator {
  constructor(
    public keys: ASTIdentifier[],
    public parentKey: ASTIdentifier,
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitor: LogicalPlanVisitor<T>): T {
    return visitor.visitNest(this);
  }
}
