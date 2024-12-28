import { ASTIdentifier } from '../../../ast.js';
import {
  Aliased,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';

export class TupleSource implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public name: ASTIdentifier | Aliased<ASTIdentifier>
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitTupleSource(this);
  }
}
