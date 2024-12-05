import { ASTIdentifier } from '../../ast.js';
import {
  Aliased,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '../visitor.js';

export type ProjectionField =
  | ASTIdentifier
  | Aliased<ASTIdentifier>
  | Aliased<LogicalPlanOperator>;
export class Projection implements LogicalPlanOperator {
  constructor(
    public fields: ProjectionField[],
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitor: LogicalPlanVisitor<T>): T {
    return visitor.visitProjection(this);
  }
}
