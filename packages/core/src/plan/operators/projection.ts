import { ASTIdentifier } from '../../ast.js';
import {
  Aliased,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '../visitor.js';

export class Projection implements LogicalPlanOperator {
  constructor(
    public fields: (
      | ASTIdentifier
      | Aliased<ASTIdentifier>
      | Aliased<LogicalPlanOperator>
    )[],
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitor: LogicalPlanVisitor<T>): T {
    return visitor.visitProjection(this);
  }
}
