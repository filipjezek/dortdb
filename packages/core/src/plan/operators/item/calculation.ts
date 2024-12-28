import { ASTIdentifier } from '../../../ast.js';
import { LogicalPlanOperator, LogicalPlanVisitor } from '../../visitor.js';

/**
 * This is built from literals, fncalls etc. The purpose is to
 * extract required inputs for selection, projection etc.
 */
export class Calculation implements LogicalPlanOperator {
  constructor(
    public lang: string,
    public implementation: (...args: any[]) => any,
    public operands: Set<LogicalPlanOperator | ASTIdentifier>
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitCalculation(this);
  }
}
