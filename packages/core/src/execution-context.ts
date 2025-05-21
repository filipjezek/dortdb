import { ASTIdentifier } from './ast.js';
import { PlanOperator } from './plan/visitor.js';
import { VariableMap } from './visitors/variable-mapper.js';

export class ExecutionContext {
  public variableValues: unknown[] = [];
  /** same structure as {@link variableNames} */
  public variableNames: ASTIdentifier[] = [];
  public translations: Map<PlanOperator, VariableMap> = new Map();

  public get(variable: ASTIdentifier): unknown {
    return this.variableValues[variable.parts[0] as number];
  }

  public set(variable: ASTIdentifier, value: unknown): void {
    this.variableValues[variable.parts[0] as number] = value;
  }
}
