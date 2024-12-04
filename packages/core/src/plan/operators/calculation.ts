import { ASTIdentifier, ASTNode } from '../../ast.js';
import { LogicalPlanOperator, LogicalPlanVisitor } from '../visitor.js';

export class Calculation implements LogicalPlanOperator {
  private _inputs: (LogicalPlanOperator | ASTIdentifier)[] = [];
  public get inputs() {
    return this._inputs;
  }

  constructor(public expression: ASTNode) {
    this._inputs = this.parse();
  }

  /**
   * extracts the inputs from the expression and stores them in the `inputs` array
   */
  private parse(): (LogicalPlanOperator | ASTIdentifier)[] {
    const inputs: (LogicalPlanOperator | ASTIdentifier)[] = [];
    return inputs;
  }

  accept<T>(visitor: LogicalPlanVisitor<T>): T {
    return visitor.visitCalculation(this);
  }
}
