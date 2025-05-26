import {
  OpOrId,
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../plan/visitor.js';
import * as plan from '../plan/operators/index.js';
import { ExecutionContext } from '../execution-context.js';
import { DortDBAsFriend } from '../db.js';
import { allAttrs, ASTIdentifier } from '../ast.js';
import { VariableMapperCtx } from './variable-mapper.js';
import { retI1, toArray } from '../internal-fns/index.js';

export class Executor
  implements PlanVisitor<Iterable<unknown>, ExecutionContext>
{
  constructor(
    protected vmap: Record<
      string,
      PlanVisitor<Iterable<unknown>, ExecutionContext>
    >,
    protected db: DortDBAsFriend,
  ) {}

  public execute(
    plan: PlanOperator,
    varMapperCtx: VariableMapperCtx,
  ): { result: Iterable<unknown>; ctx: ExecutionContext } {
    const ctx = new ExecutionContext();
    ctx.translations = varMapperCtx.translations;
    ctx.variableNames = varMapperCtx.variableNames;
    const result = plan.accept(this.vmap, ctx);
    return { result, ctx };
  }

  protected processItem(
    item: ASTIdentifier | plan.Calculation,
    ctx: ExecutionContext,
  ) {
    if (item instanceof ASTIdentifier) {
      return ctx.get(item);
    }
    return this.visitCalculation(item, ctx)[0];
  }

  visitRecursion(
    operator: plan.Recursion,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  *visitProjection(
    operator: plan.Projection,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    for (const item of operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      const result: unknown[] = [];
      for (const attr of operator.attrs) {
        result[attr[1].parts[0] as number] = this.processItem(attr[0], ctx);
      }
      for (const attr of operator.attrs) {
        ctx.set(attr[1], result[attr[1].parts[0] as number]);
      }
      yield result;
    }
  }
  *visitSelection(
    operator: plan.Selection,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    for (const item of operator.source.accept(this.vmap, ctx)) {
      const passes = this.visitCalculation(operator.condition, ctx)[0];
      if (passes) yield item;
    }
  }
  visitTupleSource(
    operator: plan.TupleSource,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitItemSource(
    operator: plan.ItemSource,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitFnCall(operator: plan.FnCall, ctx: ExecutionContext): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitLiteral(
    operator: plan.Literal,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitCalculation(
    operator: plan.Calculation,
    ctx: ExecutionContext,
  ): [unknown] {
    return [
      operator.impl(
        ...operator.args.map((arg) =>
          arg instanceof ASTIdentifier
            ? ctx.get(arg)
            : toArray(arg.accept(this.vmap, ctx)),
        ),
      ),
    ];
  }
  visitConditional(
    operator: plan.Conditional,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  *visitCartesianProduct(
    operator: plan.CartesianProduct,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const right = toArray(operator.right.accept(this.vmap, ctx)) as unknown[][];
    if (right.length === 0) return [];
    const rightKeys = Object.keys(right[0]).map(Number);

    const left = operator.left.accept(this.vmap, ctx)[Symbol.iterator]();
    let leftItem = left.next();
    if (leftItem.done) return [];
    const leftKeys = Object.keys(leftItem.value)
      .map(Number)
      .filter((key) => !rightKeys.includes(key));

    do {
      const leftValue = leftItem.value;
      for (const rightValue of right) {
        const result: unknown[] = [];
        for (const key of leftKeys) {
          result[key] = leftValue[key];
        }
        for (const key of rightKeys) {
          result[key] = rightValue[key];
        }
        yield result;
      }
      leftItem = left.next();
    } while (leftItem.done === false);
  }
  *visitJoin(operator: plan.Join, ctx: ExecutionContext): Iterable<unknown> {
    if (!operator.leftOuter && !operator.rightOuter) {
      for (const item of this.visitCartesianProduct(operator, ctx)) {
        const passes = operator.conditions.every(
          (c) => this.visitCalculation(c, ctx)[0],
        );
        if (passes) yield item;
      }
    } else if (operator.leftOuter && !operator.rightOuter) {
      return this.visitLeftJoin(
        operator.conditions,
        operator.left,
        operator.right,
        ctx,
      );
    } else if (!operator.leftOuter && operator.rightOuter) {
      return this.visitLeftJoin(
        operator.conditions,
        operator.right,
        operator.left,
        ctx,
      );
    } else {
      return this.visitFullJoin(operator, ctx);
    }
  }
  protected *visitLeftJoin(
    conditions: plan.Calculation[],
    left: PlanTupleOperator,
    right: PlanTupleOperator,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const rightItems = toArray(right.accept(this.vmap, ctx)) as unknown[][];
    const rightKeys = Array.from(
      ctx.translations.get(right).entries(),
      (x) => x[1].parts[0] as number,
    );
    const leftItems = left.accept(this.vmap, ctx)[Symbol.iterator]();
    let leftItem = leftItems.next();
    if (leftItem.done) return [];
    const leftKeys = Object.keys(leftItem.value)
      .map(Number)
      .filter((key) => !rightKeys.includes(key));
    do {
      const leftValue = leftItem.value;
      let joined = false;
      for (const rightValue of rightItems) {
        const result: unknown[] = [];
        for (const key of leftKeys) {
          result[key] = leftValue[key];
        }
        for (const key of rightKeys) {
          result[key] = rightValue[key];
        }
        if (conditions.every((c) => this.visitCalculation(c, ctx)[0])) {
          joined = true;
          yield result;
        }
      }

      if (!joined) {
        const result: unknown[] = [];
        for (const key of leftKeys) {
          result[key] = leftValue[key];
        }
        for (const key of rightKeys) {
          result[key] = null;
        }
        yield result;
      }

      leftItem = leftItems.next();
    } while (leftItem.done === false);
  }
  protected *visitFullJoin(
    operator: plan.Join,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const right = toArray(operator.right.accept(this.vmap, ctx)) as unknown[][];
    const rightKeys = Array.from(
      ctx.translations.get(operator.right).entries(),
      (x) => x[1].parts[0] as number,
    );
    const left = operator.left.accept(this.vmap, ctx) as unknown[][];
    const leftKeys = Array.from(
      ctx.translations.get(operator.left).entries(),
      (x) => x[1].parts[0] as number,
    );
    const rightSet = new Set(right);

    for (const leftItem of left) {
      let joined = false;
      for (const rightValue of right) {
        const result: unknown[] = [];
        for (const key of leftKeys) {
          result[key] = leftItem[key];
        }
        for (const key of rightKeys) {
          result[key] = rightValue[key];
        }
        if (
          operator.conditions.every((c) => this.visitCalculation(c, ctx)[0])
        ) {
          joined = true;
          rightSet.delete(rightValue);
          yield result;
        }
      }

      if (!joined) {
        const result: unknown[] = [];
        for (const key of leftKeys) {
          result[key] = leftItem[key];
        }
        for (const key of rightKeys) {
          result[key] = null;
        }
        yield result;
      }
    }
    for (const rightValue of rightSet) {
      const result: unknown[] = [];
      for (const key of leftKeys) {
        result[key] = null;
      }
      for (const key of rightKeys) {
        result[key] = rightValue[key];
      }
      yield result;
    }
  }

  *visitProjectionConcat(
    operator: plan.ProjectionConcat,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const mappedKeys = Array.from(
      ctx.translations.get(operator.mapping).entries(),
      (x) => x[1].parts[0] as number,
    );
    const emptyVal = [];
    for (const key of mappedKeys) {
      emptyVal[key] = operator.emptyVal.get(ctx.variableNames[key].parts);
    }
    const source = operator.source.accept(this.vmap, ctx)[Symbol.iterator]();
    let sourceItem = source.next();
    if (sourceItem.done) return [];
    const sourceKeys = Object.keys(sourceItem.value)
      .map(Number)
      .filter((key) => !mappedKeys.includes(key));

    const yieldRow = (sourceValue: unknown[], mappedValue: unknown[]) => {
      const result: unknown[] = [];
      for (const key of sourceKeys) {
        result[key] = sourceValue[key];
      }
      for (const key of mappedKeys) {
        result[key] = mappedValue[key];
      }
      return result;
    };
    do {
      const sourceValue = sourceItem.value;
      const mapped = operator.mapping.accept(this.vmap, ctx)[Symbol.iterator]();
      let mappedItem = mapped.next();
      if (mappedItem.done) {
        if (operator.outer) {
          yield yieldRow(sourceValue, emptyVal);
        }
        continue;
      }
      yield yieldRow(sourceValue, mappedItem.value);
      mappedItem = mapped.next();
      if (operator.validateSingleValue && !mappedItem.done) {
        throw new Error('Mapping returned more than one value');
      }
      do {
        yield yieldRow(sourceValue, mappedItem.value);
      } while ((mappedItem = mapped.next()).done === false);
      sourceItem = source.next();
    } while ((sourceItem = source.next()).done === false);
  }
  *visitMapToItem(
    operator: plan.MapToItem,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const source = operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >;
    const key = operator.key.parts[0] as number;
    if (ctx.variableNames[key].parts[0] === allAttrs) {
      return source;
    }
    for (const item of source) {
      yield item[key];
    }
  }
  *visitMapFromItem(
    operator: plan.MapFromItem,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const source = operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >;
    const key = operator.key.parts[0] as number;
    for (const item of source) {
      const res = [];
      res[key] = item;
      yield res;
    }
  }
  visitProjectionIndex(
    operator: plan.ProjectionIndex,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitOrderBy(
    operator: plan.OrderBy,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitGroupBy(
    operator: plan.GroupBy,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitLimit(operator: plan.Limit, ctx: ExecutionContext): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitUnion(operator: plan.Union, ctx: ExecutionContext): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitIntersection(
    operator: plan.Intersection,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitDifference(
    operator: plan.Difference,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitDistinct(
    operator: plan.Distinct,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitNullSource(
    operator: plan.NullSource,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    return [null];
  }
  visitAggregate(
    operator: plan.AggregateCall,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitItemFnSource(
    operator: plan.ItemFnSource,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitTupleFnSource(
    operator: plan.TupleFnSource,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitQuantifier(
    operator: plan.Quantifier,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitIndexScan(
    operator: plan.IndexScan,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
}
