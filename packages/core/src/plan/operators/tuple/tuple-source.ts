import { ASTIdentifier } from '../../../ast.js';
import {
  Aliased,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class TupleSource implements LogicalPlanTupleOperator {
  public schema: ASTIdentifier[] = null;

  constructor(
    public lang: string,
    public name: ASTIdentifier | Aliased<ASTIdentifier>
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitTupleSource(this);
  }
}

export class TupleFnSource implements LogicalPlanTupleOperator {
  public schema: ASTIdentifier[] = null;

  constructor(
    public lang: string,
    public args: (ASTIdentifier | Calculation)[],
    public impl: (...args: any[]) => Iterable<any>
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitTupleFnSource(this);
  }
}
