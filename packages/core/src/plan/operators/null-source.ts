import { ASTIdentifier } from '../../ast.js';
import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../visitor.js';

export class NullSource extends LogicalPlanTupleOperator {
  constructor(lang: Lowercase<string>) {
    super();
    this.lang = lang;
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitNullSource(this);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator
  ): void {
    throw new Error('Method not implemented.');
  }
}
