import { ASTIdentifier } from '../../ast.js';
import { LogicalPlanOperator, LogicalPlanVisitor } from '../visitor.js';

export class Sort implements LogicalPlanOperator {
  constructor(
    public sort: {
      expression: ASTIdentifier;
      ascending: boolean;
      nullsFirst: boolean;
    }[],
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitor: LogicalPlanVisitor<T>): T {
    return visitor.visitSort(this);
  }
}
