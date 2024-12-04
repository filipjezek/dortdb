import { ASTIdentifier } from '../../ast.js';
import {
  Aliased,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '../visitor.js';

export class Unnest implements LogicalPlanOperator {
  constructor(
    public key: ASTIdentifier,
    public renamings: Aliased[],
    public source: LogicalPlanOperator
  ) {}

  accept<T>(visitor: LogicalPlanVisitor<T>): T {
    return visitor.visitUnnest(this);
  }
}
