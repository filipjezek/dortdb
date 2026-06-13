import { ASTIdentifier } from './ast.js';
import { PlanOperator, PlanTupleOperator } from './plan/visitor.js';
import { VariableMap } from './visitors/variable-mapper.js';

/** Holds the runtime variable bindings and translation tables for a single query execution. */
export class ExecutionContext {
  /** Flat array of runtime values indexed by the numeric part of each variable's {@link ASTIdentifier}. */
  public variableValues: unknown[] = [];
  /** same structure as {@link variableNames} */
  public variableNames: ASTIdentifier[] = [];
  /** Per-operator variable translation maps used to locate values in {@link variableValues}. */
  public translations: Map<
    PlanOperator,
    {
      /** Variables produced by the operator itself. */
      scope: VariableMap;
      /** Variables inherited from an enclosing scope. */
      external: VariableMap;
    }
  > = new Map();

  /**
   * Returns the current value of a variable.
   * @param variable ASTIdentifier with a single numeric part used as the array index.
   */
  public get(variable: ASTIdentifier): unknown {
    return this.variableValues[variable.parts[0] as number];
  }
  /**
   * Sets the current value of a variable.
   * @param variable ASTIdentifier with a single numeric part used as the array index.
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
    return operator.schema.map(
      (x) =>
        (ts.scope.get(x.parts)?.parts[0] ??
          ts.external.get(x.parts).parts[0]) as number,
    );
  }

  /** Returns the numeric index in {@link variableValues} for `key` within `operator`'s translation. */
  public getTranslation(
    operator: PlanOperator,
    key: (string | number | symbol)[],
  ): number {
    const ts = this.translations.get(operator);
    return (ts.scope.get(key) ?? ts.external.get(key)).parts[0] as number;
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
        (
          targetTs.scope.get(x.parts) ??
          sourceTs.scope.get(x.parts) ??
          sourceTs.external.get(x.parts)
        ).parts[0] as number,
    );
  }
}
