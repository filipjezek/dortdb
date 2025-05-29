import { ASTIdentifier } from './ast.js';
import { PlanOperator, PlanTupleOperator } from './plan/visitor.js';
import { VariableMap } from './visitors/variable-mapper.js';

export class ExecutionContext {
  public variableValues: unknown[] = [];
  /** same structure as {@link variableNames} */
  public variableNames: ASTIdentifier[] = [];
  public translations: Map<PlanOperator, VariableMap> = new Map();

  /**
   * @param variable ASTIdentifier with a single numeric part
   */
  public get(variable: ASTIdentifier): unknown {
    return this.variableValues[variable.parts[0] as number];
  }
  /**
   * @param variable ASTIdentifier with a single numeric part
   */
  public set(variable: ASTIdentifier, value: unknown): void {
    this.variableValues[variable.parts[0] as number] = value;
  }

  /**
   * Sets the values of the item to the context `variableValues`.
   * @param item The item to set.
   * @param keys The keys to set.
   * @returns The unchanged item.
   */
  public setTuple(item: unknown[], keys: number[]): unknown[] {
    for (const key of keys) {
      this.variableValues[key] = item[key];
    }
    return item;
  }

  /** Get numeric keys for the schema of `operator` */
  public getKeys(operator: PlanTupleOperator): number[] {
    const ts = this.translations.get(operator);
    return operator.schema.map((x) => ts.get(x.parts).parts[0] as number);
  }

  /**
   * Compute addresses of `sourceOp` keys in `targetOp` scope.
   */
  public getRenames(
    sourceOp: PlanTupleOperator,
    targetOp: PlanTupleOperator,
  ): number[] {
    const sourceTs = this.translations.get(sourceOp);
    const targetTs = this.translations.get(targetOp);
    return sourceOp.schema.map(
      (x) =>
        (targetTs.get(x.parts) ?? sourceTs.get(x.parts)).parts[0] as number,
    );
  }
}
