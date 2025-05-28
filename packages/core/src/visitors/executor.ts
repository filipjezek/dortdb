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
import { Trie } from '../data-structures/trie.js';

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
  ): unknown {
    if (item instanceof ASTIdentifier) {
      return ctx.get(item);
    }
    return this.visitCalculation(item, ctx)[0];
  }

  /**
   * Sets the values of the item to the context variableValues.
   * @param item The item to set.
   * @param keys The keys to set.
   * @param ctx The execution context.
   * @returns The unchanged item.
   */
  protected setToCtx(
    item: unknown[],
    keys: number[],
    ctx: ExecutionContext,
  ): unknown[] {
    for (const key of keys) {
      ctx.variableValues[key] = item[key];
    }
    return item;
  }

  /** Rename the `item` to use another scope addressing */
  protected renameKeys(
    item: unknown[],
    oldKeys: number[],
    newKeys: number[],
  ): unknown[] {
    const result: unknown[] = [];
    for (let i = 0; i < oldKeys.length; i++) {
      result[newKeys[i]] = item[oldKeys[i]];
    }
    return result;
  }

  /** Get numeric keys for the schema of `operator` */
  protected getKeys(
    operator: PlanTupleOperator,
    ctx: ExecutionContext,
  ): number[] {
    const ts = ctx.translations.get(operator);
    return operator.schema.map((x) => ts.get(x.parts).parts[0] as number);
  }

  /**
   * Compute `newKeys` for {@link renameKeys} so that sourceOp can be renamed to targetOp.
   */
  protected getRenames(
    sourceOp: PlanTupleOperator,
    targetOp: PlanTupleOperator,
    ctx: ExecutionContext,
  ): number[] {
    const sourceTs = ctx.translations.get(sourceOp);
    const targetTs = ctx.translations.get(targetOp);
    return sourceOp.schema.map(
      (x) =>
        (targetTs.get(x.parts) ?? sourceTs.get(x.parts)).parts[0] as number,
    );
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
    const keys = operator.attrs.map((attr) => attr[1].parts[0] as number);
    for (const item of operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      const result: unknown[] = [];
      for (const attr of operator.attrs) {
        result[attr[1].parts[0] as number] = this.processItem(attr[0], ctx);
      }
      yield this.setToCtx(result, keys, ctx);
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
    const source = this.db.getSource((operator.name as ASTIdentifier).parts);
    return this.generateTuplesFromValues(
      source as Iterable<unknown>,
      operator,
      ctx,
    );
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
    const rightKeys = this.getKeys(operator.right, ctx);

    const left = operator.left.accept(this.vmap, ctx) as Iterable<unknown[]>;
    const leftKeys = this.getKeys(operator.left, ctx);
    const resultKeys = this.getKeys(operator, ctx);
    const renameRightKeys = this.getRenames(operator.right, operator, ctx);

    for (const leftItem of left) {
      for (const rightItem of right) {
        const result: unknown[] = [];
        for (const key of leftKeys) {
          result[key] = leftItem[key];
        }
        for (let i = 0; i < rightKeys.length; i++) {
          result[renameRightKeys[i]] = rightItem[rightKeys[i]];
        }
        yield this.setToCtx(result, resultKeys, ctx);
      }
    }
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
        operator,
        ctx,
      );
    } else if (!operator.leftOuter && operator.rightOuter) {
      return this.visitLeftJoin(
        operator.conditions,
        operator.right,
        operator.left,
        operator,
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
    op: plan.Join,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const rightItems = toArray(right.accept(this.vmap, ctx)) as unknown[][];
    const rightKeys = this.getKeys(right, ctx);
    const leftItems = left.accept(this.vmap, ctx) as Iterable<unknown[]>;
    const leftKeys = this.getKeys(left, ctx);
    const renameRightKeys = this.getRenames(right, op, ctx);
    const resultKeys = this.getKeys(op, ctx);

    for (const leftItem of leftItems) {
      let joined = false;
      for (const rightItem of rightItems) {
        const result: unknown[] = [];
        for (const key of leftKeys) {
          result[key] = leftItem[key];
        }
        for (let i = 0; i < rightKeys.length; i++) {
          result[renameRightKeys[i]] = rightItem[rightKeys[i]];
        }
        this.setToCtx(result, resultKeys, ctx);
        if (conditions.every((c) => this.visitCalculation(c, ctx)[0])) {
          joined = true;
          yield result;
        }
      }

      if (!joined) {
        const result: unknown[] = [];
        for (const key of leftKeys) {
          result[key] = leftItem[key];
        }
        for (const key of renameRightKeys) {
          result[key] = null;
        }
        yield this.setToCtx(result, resultKeys, ctx);
      }
    }
  }
  protected *visitFullJoin(
    operator: plan.Join,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const right = toArray(operator.right.accept(this.vmap, ctx)) as unknown[][];
    const rightKeys = this.getKeys(operator.right, ctx);
    const left = operator.left.accept(this.vmap, ctx) as unknown[][];
    const leftKeys = this.getKeys(operator.left, ctx);
    const renameRightKeys = this.getRenames(operator.right, operator, ctx);
    const resultKeys = this.getKeys(operator, ctx);
    const rightSet = new Set(right);

    for (const leftItem of left) {
      let joined = false;
      for (const rightItem of right) {
        const result: unknown[] = [];
        for (const key of leftKeys) {
          result[key] = leftItem[key];
        }
        for (let i = 0; i < rightKeys.length; i++) {
          result[renameRightKeys[i]] = rightItem[rightKeys[i]];
        }
        this.setToCtx(result, resultKeys, ctx);
        if (
          operator.conditions.every((c) => this.visitCalculation(c, ctx)[0])
        ) {
          joined = true;
          rightSet.delete(rightItem);
          yield result;
        }
      }

      if (!joined) {
        const result: unknown[] = [];
        for (const key of leftKeys) {
          result[key] = leftItem[key];
        }
        for (const key of renameRightKeys) {
          result[key] = null;
        }
        yield this.setToCtx(result, resultKeys, ctx);
      }
    }
    for (const rightItem of rightSet) {
      const result: unknown[] = [];
      for (const key of leftKeys) {
        result[key] = null;
      }
      for (let i = 0; i < rightKeys.length; i++) {
        result[renameRightKeys[i]] = rightItem[rightKeys[i]];
      }
      yield this.setToCtx(result, resultKeys, ctx);
    }
  }

  *visitProjectionConcat(
    operator: plan.ProjectionConcat,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const mappedKeys = this.getKeys(operator.mapping, ctx);
    const emptyVal = [];
    for (const key of mappedKeys) {
      emptyVal[key] = operator.emptyVal.get([key]);
    }
    const source = operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >;
    const sourceKeys = this.getKeys(operator.source, ctx);
    const resultKeys = this.getKeys(operator, ctx);
    const renameMappedKeys = this.getRenames(operator.mapping, operator, ctx);

    const yieldRow = (sourceItem: unknown[], mappedItem: unknown[]) => {
      const result: unknown[] = [];
      for (const key of sourceKeys) {
        result[key] = sourceItem[key];
      }
      for (let i = 0; i < mappedKeys.length; i++) {
        result[renameMappedKeys[i]] = mappedItem[mappedKeys[i]];
      }
      return this.setToCtx(result, resultKeys, ctx);
    };
    for (const sourceItem of source) {
      const mapped = operator.mapping.accept(this.vmap, ctx)[Symbol.iterator]();
      let mappedItem = mapped.next();
      if (mappedItem.done) {
        if (operator.outer) {
          yield yieldRow(sourceItem, emptyVal);
        }
        continue;
      }
      yield yieldRow(sourceItem, mappedItem.value);
      mappedItem = mapped.next();
      if (operator.validateSingleValue && !mappedItem.done) {
        throw new Error('Mapping returned more than one value');
      } else if (mappedItem.done) continue;
      do {
        yield yieldRow(sourceItem, mappedItem.value);
      } while (!(mappedItem = mapped.next()).done);
    }
  }
  *visitMapToItem(
    operator: plan.MapToItem,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const source = operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >;
    const key = operator.key.parts[0] as number;
    if (ctx.translations.get(operator).get([allAttrs])?.parts[0] === key) {
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
      ctx.variableValues[key] = item;
      yield res;
    }
  }
  *visitProjectionIndex(
    operator: plan.ProjectionIndex,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    let index = 1;
    const keys = this.getKeys(operator.source, ctx);
    const indexKey = operator.indexCol.parts[0] as number;
    for (const item of operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      const result: unknown[] = [];
      for (const key of keys) {
        result[key] = item[key];
      }
      ctx.variableValues[indexKey] = index;
      result[indexKey] = index++;
      yield result;
    }
  }
  *visitOrderBy(
    operator: plan.OrderBy,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const source: unknown[][] = [];
    const indexCol = Symbol('indexCol');
    const precomputed: (unknown[] & { [indexCol]: number })[] = [];
    const keys = this.getKeys(operator, ctx);
    let i = 0;
    for (const item of operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      source.push(item);
      const preItem: any = operator.orders.map((o) =>
        this.processItem(o.key, ctx),
      );
      preItem[indexCol] = i++;
      precomputed.push(preItem);
    }
    precomputed.sort((a, b) => {
      for (let i = 0; i < operator.orders.length; i++) {
        const order = operator.orders[i];
        const aVal = a[i];
        const bVal = b[i];
        if (aVal === bVal) continue;
        if (aVal === null) return order.nullsFirst ? -1 : 1;
        if (bVal === null) return order.nullsFirst ? 1 : -1;
        if (aVal < bVal) return order.ascending ? -1 : 1;
        return order.ascending ? 1 : -1;
      }
      return 0;
    });
    for (const item of precomputed) {
      yield this.setToCtx(source[item[indexCol]], keys, ctx);
    }
  }
  *visitGroupBy(
    operator: plan.GroupBy,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const groups = new Trie<unknown, unknown[][]>();
    const aggKeys = operator.aggs.map((agg) =>
      this.getKeys(agg.postGroupSource, ctx),
    );
    const srcKeys = this.getKeys(operator.source, ctx);
    const resultKeys = this.getKeys(operator, ctx);

    for (const item of operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      const groupKey = operator.keys.map((key) =>
        this.processItem(key[0], ctx),
      );
      let group = groups.get(groupKey);
      if (!group) {
        group = [];
        groups.set(groupKey, group);
      }
      group.push(item);
    }

    const originalAggAcepts = operator.aggs.map(
      (agg) => agg.postGroupSource.accept,
    );
    for (const [groupValues, group] of groups.entries()) {
      const result: unknown[] = [];
      for (let i = 0; i < operator.aggs.length; i++) {
        const agg = operator.aggs[i];
        agg.postGroupSource.accept = function* (this: Executor) {
          for (const item of group) {
            yield this.setToCtx(
              this.renameKeys(item, srcKeys, aggKeys[i]),
              aggKeys[i],
              ctx,
            );
          }
        }.bind(this) as any;
        let state = agg.impl.init();
        for (const item of agg.postGroupOp.accept(this.vmap, ctx)) {
          state = agg.impl.step(
            state,
            ...agg.args.map((a) => this.processItem(a, ctx)),
          );
        }
        result[agg.fieldName.parts[0] as number] = agg.impl.result(state);
      }
      for (const key of srcKeys) {
        result[key] = group[0][key];
      }
      yield this.setToCtx(result, resultKeys, ctx);
    }
    for (let i = 0; i < operator.aggs.length; i++) {
      operator.aggs[i].postGroupSource.accept = originalAggAcepts[i];
    }
  }
  *visitLimit(operator: plan.Limit, ctx: ExecutionContext): Iterable<unknown> {
    const source = operator.source.accept(this.vmap, ctx);
    let count = 0;
    for (const item of source) {
      if (count >= operator.limit + operator.skip) break;
      if (count >= operator.skip) yield item;
      count++;
    }
  }
  *visitUnion(operator: plan.Union, ctx: ExecutionContext): Iterable<unknown> {
    yield* operator.left.accept(this.vmap, ctx);
    if (!(operator.right instanceof PlanTupleOperator)) {
      yield* operator.right.accept(this.vmap, ctx);
      return;
    }
    const keys = this.getKeys(operator, ctx);
    const rightKeys = this.getKeys(operator.right, ctx);
    for (const item of operator.right.accept(this.vmap, ctx) as Iterable<
      number[]
    >) {
      yield this.setToCtx(this.renameKeys(item, rightKeys, keys), keys, ctx);
    }
  }
  *visitIntersection(
    operator: plan.Intersection,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    if (!(operator.left instanceof PlanTupleOperator))
      return this.visitIntersectionItems(
        operator.left.accept(this.vmap, ctx),
        operator.right.accept(this.vmap, ctx),
      );
    const keys = this.getKeys(operator.left, ctx);
    const rightKeys = this.getKeys(operator.right as PlanTupleOperator, ctx);
    const left = operator.left.accept(this.vmap, ctx) as Iterable<unknown[]>;
    const leftSet = new Trie<unknown>();
    for (const item of left) {
      leftSet.add(keys.map((key) => item[key]));
    }

    for (const item of operator.right.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      const values = rightKeys.map((key) => item[key]);
      if (leftSet.has(values)) {
        yield this.setToCtx(this.renameKeys(item, rightKeys, keys), keys, ctx);
      }
    }
  }
  protected *visitIntersectionItems(
    left: Iterable<unknown>,
    right: Iterable<unknown>,
  ) {
    const leftSet = new Set(left);
    for (const item of right) {
      if (leftSet.has(item)) {
        yield item;
      }
    }
  }
  *visitDifference(
    operator: plan.Difference,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    if (!(operator.left instanceof PlanTupleOperator))
      return this.visitDifferenceItems(
        operator.left.accept(this.vmap, ctx),
        operator.right.accept(this.vmap, ctx),
      );
    const keys = this.getKeys(operator.left, ctx);
    const rightKeys = this.getKeys(operator.right as PlanTupleOperator, ctx);
    const right = operator.right.accept(this.vmap, ctx) as Iterable<unknown[]>;
    const rightSet = new Trie<unknown>();
    for (const item of right) {
      rightSet.add(rightKeys.map((key) => item[key]));
    }

    for (const item of operator.left.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      const values = keys.map((key) => item[key]);
      if (!rightSet.has(values)) {
        yield item;
      }
    }
  }
  protected *visitDifferenceItems(
    left: Iterable<unknown>,
    right: Iterable<unknown>,
  ) {
    const rightSet = new Set(right);
    for (const item of left) {
      if (!rightSet.has(item)) {
        yield item;
      }
    }
  }
  *visitDistinct(
    operator: plan.Distinct,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const seen = new Trie<unknown>();
    const keys = this.getKeys(operator, ctx);
    const getValues =
      operator.attrs === allAttrs
        ? (item: unknown[]) => keys.map((key) => item[key])
        : () =>
            (operator.attrs as (plan.Calculation | ASTIdentifier)[]).map(
              (attr) => this.processItem(attr, ctx),
            );
    for (const item of operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      const values = getValues(item);
      if (!seen.has(values)) {
        seen.add(values);
        yield item;
      }
    }
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
    return operator.impl(
      ...operator.args.map((arg) => this.processItem(arg, ctx)),
    );
  }
  visitTupleFnSource(
    operator: plan.TupleFnSource,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const source = operator.impl(
      ...operator.args.map((arg) => this.processItem(arg, ctx)),
    );
    return this.generateTuplesFromValues(source, operator, ctx);
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
    const source = this.visitCalculation(operator.access, ctx)[0] as Iterable<
      unknown[]
    >;
    return this.generateTuplesFromValues(source, operator, ctx);
  }

  protected generateTuplesFromValues(
    values: Iterable<unknown>,
    operator: PlanTupleOperator,
    ctx: ExecutionContext,
  ): Iterable<unknown[]> {
    throw new Error('Method not implemented.');
  }
}
