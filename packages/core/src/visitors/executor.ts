import {
  OpOrId,
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../plan/visitor.js';
import * as plan from '../plan/operators/index.js';
import { ExecutionContext } from '../execution-context.js';
import { DortDBAsFriend } from '../db.js';
import { allAttrs, ASTIdentifier, boundParam } from '../ast.js';
import { VariableMapperCtx } from './variable-mapper.js';
import { retI1, toArray } from '../internal-fns/index.js';
import { Trie } from '../data-structures/trie.js';
import { SerializeFn } from '../lang-manager.js';
import { Queue } from 'mnemonist';

export abstract class Executor
  implements PlanVisitor<Iterable<unknown>, ExecutionContext>
{
  protected serialize: SerializeFn;

  constructor(
    protected lang: Lowercase<string>,
    protected vmap: Record<
      string,
      PlanVisitor<Iterable<unknown>, ExecutionContext>
    >,
    protected db: DortDBAsFriend,
  ) {
    this.serialize = this.db.langMgr.getLang(this.lang).serialize;
  }

  public execute(
    plan: PlanOperator,
    varMapperCtx: VariableMapperCtx,
    boundParams?: Record<string, unknown>,
  ): { result: Iterable<unknown>; ctx: ExecutionContext } {
    const ctx = new ExecutionContext();

    if (boundParams) {
      const scope = varMapperCtx.scopeStack[0];
      for (const [key, value] of Object.entries(boundParams)) {
        const variable = scope.get([boundParam, key]);
        if (!variable) throw new Error(`Bound parameter ${key} not found`);
        ctx.set(variable, value);
      }
    }

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

  *visitRecursion(
    operator: plan.Recursion,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    if (operator.min > operator.max || operator.max === 0) return;
    const queue = new Queue<unknown[][]>();
    const items: unknown[][] = [];
    const keys = ctx.getKeys(operator);
    for (const item of operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      items.push(item);
      const toQueue = [];
      for (const key of keys) {
        toQueue[key] = [item[key]];
      }
      if (operator.min <= 1) {
        yield ctx.setTuple(toQueue, keys);
      }
      if (operator.max > 1) {
        queue.enqueue(toQueue);
      }
    }

    while (queue.size > 0) {
      const item = queue.dequeue();
      for (const next of items) {
        for (const key of keys) {
          ctx.variableValues[key] = [item[key], next[key]];
        }
        if (!this.visitCalculation(operator.condition, ctx)[0]) continue;

        const result: unknown[][] = [];
        for (const key of keys) {
          result[key] = item[key].concat([next[key]]);
        }
        const size = result[keys[0]].length;
        if (size >= operator.min) {
          yield ctx.setTuple(result, keys);
        }
        if (size < operator.max) {
          queue.enqueue(result);
        }
      }
    }
  }
  *visitIndexedRecursion(
    operator: plan.IndexedRecursion,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    if (operator.min > operator.max || operator.max === 0) return;
    const queue = new Queue<unknown[][]>();
    const keys = ctx.getKeys(operator);
    const renameMappedKeys = ctx.getRenames(operator, operator.mapping);
    for (const item of operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      const toQueue = [];
      for (const key of keys) {
        toQueue[key] = [item[key]];
      }
      if (operator.min <= 1) {
        yield ctx.setTuple(toQueue, keys);
      }
      if (operator.max > 1) {
        queue.enqueue(toQueue);
      }
    }

    while (queue.size > 0) {
      const item = queue.dequeue();
      for (const key of keys) {
        ctx.variableValues[key] = item[key];
      }
      for (const next of operator.mapping.accept(this.vmap, ctx) as Iterable<
        unknown[]
      >) {
        const result: unknown[][] = [];
        for (let i = 0; i < keys.length; i++) {
          result[keys[i]] = item[keys[i]].concat([next[renameMappedKeys[i]]]);
        }
        const size = result[keys[0]].length;
        if (size >= operator.min) {
          yield ctx.setTuple(result, keys);
        }
        if (size < operator.max) {
          queue.enqueue(result);
        }
      }
    }
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
      yield ctx.setTuple(result, keys);
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
    if (right.length === 0) return;
    const rightKeys = ctx.getKeys(operator.right);

    const left = operator.left.accept(this.vmap, ctx) as Iterable<unknown[]>;
    const leftKeys = ctx.getKeys(operator.left);
    const resultKeys = ctx.getKeys(operator);
    const renameRightKeys = ctx.getRenames(operator.right, operator);

    for (const leftItem of left) {
      for (const rightItem of this.validateSingleValue(operator, right)) {
        const result: unknown[] = [];
        for (const key of leftKeys) {
          result[key] = leftItem[key];
        }
        for (let i = 0; i < rightKeys.length; i++) {
          result[renameRightKeys[i]] = rightItem[rightKeys[i]];
        }
        yield ctx.setTuple(result, resultKeys);
      }
    }
  }
  *visitJoin(operator: plan.Join, ctx: ExecutionContext): Iterable<unknown> {
    if (!operator.leftOuter && !operator.rightOuter) {
      const rightItems = toArray(
        operator.right.accept(this.vmap, ctx),
      ) as unknown[][];
      const rightKeys = ctx.getKeys(operator.right);
      const leftItems = operator.left.accept(this.vmap, ctx) as Iterable<
        unknown[]
      >;
      const leftKeys = ctx.getKeys(operator.left);
      const renameRightKeys = ctx.getRenames(operator.right, operator);
      const resultKeys = ctx.getKeys(operator);

      for (const leftItem of leftItems) {
        yield* this.validateSingleValue(
          operator,
          Iterator.from(rightItems)
            .map((rightItem) => {
              const result: unknown[] = [];
              for (const key of leftKeys) {
                result[key] = leftItem[key];
              }
              for (let i = 0; i < rightKeys.length; i++) {
                result[renameRightKeys[i]] = rightItem[rightKeys[i]];
              }
              ctx.setTuple(result, resultKeys);
              if (
                operator.conditions.every(
                  (c) => this.visitCalculation(c, ctx)[0],
                )
              ) {
                return result;
              }
              return undefined;
            })
            .filter((x) => x),
        );
      }
    } else if (operator.leftOuter && !operator.rightOuter) {
      yield* this.visitLeftJoin(
        operator.conditions,
        operator.left,
        operator.right,
        operator,
        ctx,
      );
    } else if (!operator.leftOuter && operator.rightOuter) {
      yield* this.visitLeftJoin(
        operator.conditions,
        operator.right,
        operator.left,
        operator,
        ctx,
      );
    } else {
      yield* this.visitFullJoin(operator, ctx);
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
    const rightKeys = ctx.getKeys(right);
    const leftItems = left.accept(this.vmap, ctx) as Iterable<unknown[]>;
    const leftKeys = ctx.getKeys(left);
    const renameRightKeys = ctx.getRenames(right, op);
    const resultKeys = ctx.getKeys(op);

    for (const leftItem of leftItems) {
      let joined = false;
      yield* this.validateSingleValue(
        op,
        Iterator.from(rightItems)
          .map((rightItem) => {
            const result: unknown[] = [];
            for (const key of leftKeys) {
              result[key] = leftItem[key];
            }
            for (let i = 0; i < rightKeys.length; i++) {
              result[renameRightKeys[i]] = rightItem[rightKeys[i]];
            }
            ctx.setTuple(result, resultKeys);
            if (conditions.every((c) => this.visitCalculation(c, ctx)[0])) {
              joined = true;
              return result;
            }
            return undefined;
          })
          .filter((x) => x),
      );

      if (!joined) {
        const result: unknown[] = [];
        for (const key of leftKeys) {
          result[key] = leftItem[key];
        }
        for (const key of renameRightKeys) {
          result[key] = null;
        }
        yield ctx.setTuple(result, resultKeys);
      }
    }
  }
  protected *visitFullJoin(
    operator: plan.Join,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const right = toArray(operator.right.accept(this.vmap, ctx)) as unknown[][];
    const rightKeys = ctx.getKeys(operator.right);
    const left = operator.left.accept(this.vmap, ctx) as unknown[][];
    const leftKeys = ctx.getKeys(operator.left);
    const renameRightKeys = ctx.getRenames(operator.right, operator);
    const resultKeys = ctx.getKeys(operator);
    const rightSet = new Set(right);

    for (const leftItem of left) {
      let joined = false;
      yield* this.validateSingleValue(
        operator,
        Iterator.from(right)
          .map((rightItem) => {
            const result: unknown[] = [];
            for (const key of leftKeys) {
              result[key] = leftItem[key];
            }
            for (let i = 0; i < rightKeys.length; i++) {
              result[renameRightKeys[i]] = rightItem[rightKeys[i]];
            }
            ctx.setTuple(result, resultKeys);
            if (
              operator.conditions.every((c) => this.visitCalculation(c, ctx)[0])
            ) {
              joined = true;
              rightSet.delete(rightItem);
              return result;
            }
            return undefined;
          })
          .filter((x) => x),
      );

      if (!joined) {
        const result: unknown[] = [];
        for (const key of leftKeys) {
          result[key] = leftItem[key];
        }
        for (const key of renameRightKeys) {
          result[key] = null;
        }
        yield ctx.setTuple(result, resultKeys);
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
      yield ctx.setTuple(result, resultKeys);
    }
  }

  *visitProjectionConcat(
    operator: plan.ProjectionConcat,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const mappedKeys = ctx.getKeys(operator.mapping);
    const emptyVal = [];
    for (const key of mappedKeys) {
      emptyVal[key] = operator.emptyVal.get([key]);
    }
    const source = operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >;
    const sourceKeys = ctx.getKeys(operator.source);
    const resultKeys = ctx.getKeys(operator);
    const renameMappedKeys = ctx.getRenames(operator.mapping, operator);

    const yieldRow = (sourceItem: unknown[], mappedItem: unknown[]) => {
      const result: unknown[] = [];
      for (const key of sourceKeys) {
        result[key] = sourceItem[key];
      }
      for (let i = 0; i < mappedKeys.length; i++) {
        result[renameMappedKeys[i]] = mappedItem[mappedKeys[i]];
      }
      return ctx.setTuple(result, resultKeys);
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

  protected validateSingleValue<T>(
    operator: { validateSingleValue: boolean },
    items: Iterable<T>,
  ): Iterable<T> {
    if (operator.validateSingleValue) {
      const iter = items[Symbol.iterator]();
      const value = iter.next().value;
      if (!iter.next().done) {
        throw new Error('Operator returned more than one value');
      }
      return [value];
    }
    return items;
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
      yield* this.serialize(source, ctx, operator.source).data;
      return;
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
      res[key] = ctx.variableValues[key] = item;
      yield res;
    }
  }
  *visitProjectionIndex(
    operator: plan.ProjectionIndex,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    let index = 1;
    const keys = ctx.getKeys(operator.source);
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
    const keys = ctx.getKeys(operator);
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
      yield ctx.setTuple(source[item[indexCol]], keys);
    }
  }
  *visitGroupBy(
    operator: plan.GroupBy,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const groups = new Trie<unknown, unknown[][]>();
    const aggKeys = operator.aggs.map((agg) =>
      ctx.getKeys(agg.postGroupSource),
    );
    const srcKeys = ctx.getKeys(operator.source);
    const resultKeys = ctx.getKeys(operator);
    const keyKeys = operator.keys.map((x) => x[1].parts[0] as number);

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
    for (const [groupKey, group] of groups.size === 0 &&
    operator.keys.length === 0
      ? ([[[], []]] as [unknown[], unknown[][]][])
      : groups.entries()) {
      const result: unknown[] = [];
      for (let i = 0; i < keyKeys.length; i++) {
        result[keyKeys[i]] = groupKey[i];
      }
      if (group.length > 0) {
        for (const key of srcKeys) {
          result[key] = group[0][key];
        }
      }
      for (let i = 0; i < operator.aggs.length; i++) {
        const agg = operator.aggs[i];
        agg.postGroupSource.accept = () =>
          Iterator.from(group).map((item) => {
            return ctx.setTuple(
              this.renameKeys(item, srcKeys, aggKeys[i]),
              aggKeys[i],
            );
          }) as any;
        let state = agg.impl.init();
        for (const item of agg.postGroupOp.accept(this.vmap, ctx)) {
          state = agg.impl.step(
            state,
            ...agg.args.map((a) => this.processItem(a, ctx)),
          );
        }
        result[agg.fieldName.parts[0] as number] = agg.impl.result(state);
      }
      yield ctx.setTuple(result, resultKeys);
    }
    for (let i = 0; i < operator.aggs.length; i++) {
      operator.aggs[i].postGroupSource.accept = originalAggAcepts[i];
    }
  }
  *visitLimit(operator: plan.Limit, ctx: ExecutionContext): Iterable<unknown> {
    const source = operator.source.accept(this.vmap, ctx);
    let count = 0;
    if (Array.isArray(source)) {
      yield* source.slice(operator.skip, operator.limit + operator.skip);
      return;
    }
    for (const item of source) {
      count++;
      if (count > operator.skip) yield item;
      if (count === operator.limit + operator.skip) break;
    }
  }
  *visitUnion(operator: plan.Union, ctx: ExecutionContext): Iterable<unknown> {
    yield* operator.left.accept(this.vmap, ctx);
    if (!(operator.right instanceof PlanTupleOperator)) {
      yield* operator.right.accept(this.vmap, ctx);
      return;
    }
    const keys = ctx.getKeys(operator);
    const rightKeys = ctx.getKeys(operator.right);
    for (const item of operator.right.accept(this.vmap, ctx) as Iterable<
      number[]
    >) {
      yield ctx.setTuple(this.renameKeys(item, rightKeys, keys), keys);
    }
  }
  *visitIntersection(
    operator: plan.Intersection,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    if (!(operator.left instanceof PlanTupleOperator)) {
      yield* this.visitIntersectionItems(
        operator.left.accept(this.vmap, ctx),
        operator.right.accept(this.vmap, ctx),
      );
      return;
    }
    const keys = ctx.getKeys(operator.left);
    const rightKeys = ctx.getKeys(operator.right as PlanTupleOperator);
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
        yield ctx.setTuple(this.renameKeys(item, rightKeys, keys), keys);
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
    if (!(operator.left instanceof PlanTupleOperator)) {
      yield* this.visitDifferenceItems(
        operator.left.accept(this.vmap, ctx),
        operator.right.accept(this.vmap, ctx),
      );
      return;
    }
    const keys = ctx.getKeys(operator.left);
    const rightKeys = ctx.getKeys(operator.right as PlanTupleOperator);
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
    const keys = ctx.getKeys(operator);
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
  *visitIndexScan(
    operator: plan.IndexScan,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const source = this.visitCalculation(operator.access, ctx)[0] as Iterable<
      unknown[]
    >;
    if (operator.fromItemKey) {
      const key = operator.fromItemKey.parts[0] as number;
      for (const item of source) {
        const result: unknown[] = [];
        result[key] = ctx.variableValues[key] = item;
        yield result;
      }
    } else {
      yield* this.generateTuplesFromValues(source, operator, ctx);
    }
  }

  protected generateTuplesFromValues(
    values: Iterable<unknown>,
    operator: PlanTupleOperator,
    ctx: ExecutionContext,
  ): Iterable<unknown[]> {
    throw new Error('Method not implemented.');
  }
}
