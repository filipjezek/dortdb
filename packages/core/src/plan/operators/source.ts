import { ASTIdentifier } from '../../ast.js';
import {
  Aliased,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '../visitor.js';

export class Source implements LogicalPlanOperator {
  constructor(public name: ASTIdentifier | Aliased<ASTIdentifier>) {}

  accept<T>(visitor: LogicalPlanVisitor<T>): T {
    return visitor.visitSource(this);
  }
}
