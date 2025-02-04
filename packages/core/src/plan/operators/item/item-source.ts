import { ASTIdentifier } from '../../../ast.js';
import {
  Aliased,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';

export class ItemSource implements LogicalPlanOperator {
  constructor(
    public lang: Lowercase<string>,
    public name: ASTIdentifier | Aliased<ASTIdentifier>
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitItemSource(this);
  }
}

export class ItemFnSource implements LogicalPlanOperator {
  constructor(
    public lang: Lowercase<string>,
    public args: (ASTIdentifier | LogicalPlanOperator)[],
    public impl: (...args: any[]) => Iterable<any>
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitItemFnSource(this);
  }
}
