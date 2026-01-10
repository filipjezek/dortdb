import {
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../plan/visitor.js';
import * as plan from '../plan/operators/index.js';
import { ExecutionContext } from '../execution-context.js';
import { DortDBAsFriend } from '../db.js';
import { allAttrs, ASTIdentifier, boundParam } from '../ast.js';
import { VariableMapperCtx } from './variable-mapper.js';
import { pickArr, toArray } from '../internal-fns/index.js';
import { Trie } from '../data-structures/trie.js';
import { SerializeFn } from '../lang-manager.js';
import { Queue } from 'mnemonist';
import { LinkedListNode } from '../data-structures/index.js';
import { difference, union } from '../utils/trie.js';
import { TransitiveDependencies } from './transitive-deps.js';

/**
 * Convert a linked list of arrays into an array of arrays, collecting values for specified keys.
 * @param row Linked list containing the current values
 * @param keys keys to extract
 * @param initialKeys keys contained only in the initial row (will not be wrapped in arrays)
 * @returns Array of arrays representing the collected values for each key
 */
export function llToArray(
  row: LinkedListNode<unknown[]>,
  keys: number[],
): unknown[][];
export function llToArray(
  row: LinkedListNode<unknown[]>,
  keys: number[],
  initialKeys: number[],
): (unknown[] | unknown)[];
export function llToArray(
  row: LinkedListNode<unknown[]>,
  keys: number[],
  initialKeys?: number[],
): (unknown[] | unknown)[] {
  const result: (unknown[] | unknown)[] = [];
  for (const key of keys) {
    result[key] = [];
  }
  while (row.next) {
    for (const key of keys) {
      (result[key] as unknown[]).push(row.value[key]);
    }
    row = row.next;
  }
  if (initialKeys) {
    for (const key of initialKeys) {
      result[key] = row.value[key];
    }
  }
  for (const key of keys) {
    (result[key] as unknown[]).push(row.value[key]);
    (result[key] as unknown[]).reverse();
  }
  return result;
}

export function makeRenamer(keys: number[], renames: number[]) {
  return (item: unknown[]) => {
    const result: unknown[] = [];
    for (let i = 0; i < keys.length; i++) {
      result[renames[i]] = item[keys[i]];
    }
    return result;
  };
}

/**
 * Execute a query plan. Languages have to provide their own implementation of {@link generateTuplesFromValues}
 */
export abstract class Executor implements PlanVisitor<
  Iterable<unknown>,
  ExecutionContext
> {
  protected serialize: SerializeFn;
  protected tdeps: Record<string, TransitiveDependencies> = {};

  constructor(
    protected lang: Lowercase<string>,
    protected vmap: Record<
      string,
      PlanVisitor<Iterable<unknown>, ExecutionContext>
    >,
    protected db: DortDBAsFriend,
  ) {
    this.serialize = this.db.langMgr.getLang(this.lang).serialize;
    this.tdeps = db.langMgr.getVisitorMap('transitiveDependencies');
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
    const queue = new Queue<LinkedListNode<unknown[]>>();
    const items: unknown[][] = [];
    const keys = ctx.getKeys(operator);
    for (const item of operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      items.push(item);
      const toQueue = new LinkedListNode<unknown[]>([]);
      for (const key of keys) {
        toQueue.value[key] = item[key];
      }
      if (operator.min <= 1) {
        yield ctx.setTuple(llToArray(toQueue, keys), keys);
      }
      if (operator.max > 1) {
        queue.enqueue(toQueue);
      }
    }

    let level = 1;
    while (queue.size > 0) {
      level++;
      const levelSize = queue.size;
      for (let i = 0; i < levelSize; i++) {
        const item = queue.dequeue();
        for (const next of items) {
          const arrayed = llToArray(item, keys);
          for (const key of keys) {
            ctx.variableValues[key] = [arrayed[key], next[key]];
          }
          if (!this.visitCalculation(operator.condition, ctx)[0]) continue;

          if (level >= operator.min) {
            for (const key of keys) {
              arrayed[key].push(next[key]);
            }
            yield ctx.setTuple(arrayed, keys);
          }
          if (level < operator.max) {
            const result = new LinkedListNode<unknown[]>([], item);
            for (const key of keys) {
              result.value[key] = next[key];
            }
            queue.enqueue(result);
          }
        }
      }
    }
  }
  *visitIndexedRecursion(
    operator: plan.IndexedRecursion,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    if (operator.min > operator.max || operator.max === 0) return;
    const queue = new Queue<LinkedListNode<unknown[]>>();
    const keys = ctx.getKeys(operator);
    const renameMappedKeys = ctx.getRenames(operator, operator.mapping);

    for (const item of operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      const toQueue = new LinkedListNode<unknown[]>([]);
      for (const key of keys) {
        toQueue.value[key] = item[key];
      }
      if (operator.min <= 1) {
        yield ctx.setTuple(llToArray(toQueue, keys), keys);
      }
      if (operator.max > 1) {
        queue.enqueue(toQueue);
      }
    }

    let level = 1;
    while (queue.size > 0) {
      level++;
      const levelSize = queue.size;
      for (let i = 0; i < levelSize; i++) {
        const item = queue.dequeue();
        ctx.setTuple(llToArray(item, keys), keys);
        for (const next of operator.mapping.accept(this.vmap, ctx) as Iterable<
          unknown[]
        >) {
          if (level >= operator.min) {
            const arrayed = llToArray(item, keys);
            for (const key of keys) {
              arrayed[key].push(next[renameMappedKeys[key]]);
            }
            yield ctx.setTuple(arrayed, keys);
          }
          if (level < operator.max) {
            const result = new LinkedListNode<unknown[]>([], item);
            for (let i = 0; i < keys.length; i++) {
              result.value[keys[i]] = next[renameMappedKeys[i]];
            }
            queue.enqueue(result);
          }
        }
      }
    }
  }

  protected *expandBidiFrontier(
    frontier: Queue<LinkedListNode<unknown[]>>,
    otherFrontier: Trie<unknown, LinkedListNode<unknown[]>[]>,
    visitedItems: Trie<unknown, LinkedListNode<unknown[]>[]>,
    pathSize: number,
    getNextItems: (ctx: ExecutionContext) => Iterable<unknown[]>,
    ctx: ExecutionContext,
    min: number,
    max: number,
    keys: number[],
    initialKeys: number[],
    isForward: boolean,
    searchSpace?: Trie<unknown>,
  ) {
    const levelSize = frontier.size;

    for (let i = 0; i < levelSize; i++) {
      const item = frontier.dequeue();
      const arrayed = llToArray(item, keys, initialKeys);
      ctx.setTuple(arrayed, keys);
      ctx.setTuple(arrayed, initialKeys);
      for (const next of getNextItems(ctx)) {
        const result = new LinkedListNode<unknown[]>(next, item);

        const joinVals = pickArr(next, keys);
        if (searchSpace && !searchSpace.has(joinVals)) continue;
        if (pathSize >= min) {
          const otherPaths = otherFrontier.get(joinVals);
          if (otherPaths) {
            yield* this.joinBidiPaths(
              isForward ? [result] : otherPaths,
              isForward ? otherPaths : [result],
              ctx,
              keys,
              initialKeys,
            );
          }
        }
        if (pathSize <= max) {
          frontier.enqueue(result);
          visitedItems.get(joinVals, []).push(result);
        }
      }
    }
  }

  protected *joinBidiPaths(
    fwdPaths: LinkedListNode<unknown[]>[],
    revPaths: LinkedListNode<unknown[]>[],
    ctx: ExecutionContext,
    keys: number[],
    initialKeys: number[],
  ) {
    const allKeys = keys.concat(initialKeys);
    for (const fwdPath of fwdPaths) {
      const fwdArrayed = llToArray(fwdPath, keys, initialKeys);
      for (const key of keys) {
        (fwdArrayed[key] as unknown[]).pop();
      }
      for (let revPath of revPaths) {
        while (revPath.next) {
          for (const key of keys) {
            (fwdArrayed[key] as unknown[]).push(revPath.value[key]);
          }
          revPath = revPath.next;
        }
        for (const key of keys) {
          (fwdArrayed[key] as unknown[]).push(revPath.value[key]);
        }
        for (const key of initialKeys) {
          fwdArrayed[key] ??= revPath.value[key];
        }
        yield ctx.setTuple(fwdArrayed, allKeys);
      }
    }
  }

  protected getBidiKeys(
    operator: plan.BidirectionalRecursion,
    ctx: ExecutionContext,
  ) {
    const initialKeys = Array.from(
      difference(operator.schemaSet, operator.mappingFwd.schemaSet),
    ).map((id) => ctx.getTranslation(operator, id));
    const keys = operator.mappingFwd.schema.map((x) =>
      ctx.getTranslation(operator, x.parts),
    );

    const fwdRenames = ctx.getRenames(operator.mappingFwd, operator);
    const revRenames = ctx.getRenames(operator.mappingRev, operator);
    const tgtRenames = ctx.getRenames(operator.target, operator);
    const srcRenames = ctx.getRenames(operator.source, operator);

    const fwdKeys = ctx.getKeys(operator.mappingFwd);
    const revKeys = ctx.getKeys(operator.mappingRev);
    const tgtKeys = ctx.getKeys(operator.target);
    const srcKeys = ctx.getKeys(operator.source);

    const fwdRenamer = makeRenamer(fwdKeys, fwdRenames);
    const revRenamer = makeRenamer(revKeys, revRenames);
    const tgtRenamer = makeRenamer(tgtKeys, tgtRenames);
    const srcRenamer = makeRenamer(srcKeys, srcRenames);

    return {
      keys,
      initialKeys,
      fwdRenamer,
      revRenamer,
      tgtRenamer,
      srcRenamer,
    };
  }

  /**
   * The bidirectional recursion target may depend on the source. It is, however,
   * more efficient to process as many target items at once as possible. This method
   * returns groups of source items for which target items can be processed together.
   */
  protected getBidiGroups(
    operator: plan.BidirectionalRecursion,
    ctx: ExecutionContext,
    srcRenamer: (row: unknown[]) => unknown[],
  ): Queue<LinkedListNode<unknown[]>>[] {
    const tgtDeps = operator.target.accept(this.tdeps);
    const tgtKeys = Array.from(tgtDeps).map((id) =>
      ctx.getTranslation(operator, id),
    );

    if (tgtDeps.size === 0) {
      const q = new Queue<LinkedListNode<unknown[]>>();
      for (const item of operator.source.accept(this.vmap, ctx) as Iterable<
        unknown[]
      >) {
        const toQueue = new LinkedListNode<unknown[]>(srcRenamer(item));
        q.enqueue(toQueue);
      }
      return q.size ? [q] : [];
    }

    const groups = new Trie<unknown, Queue<LinkedListNode<unknown[]>>>();
    for (const item of operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      const toQueue = new LinkedListNode<unknown[]>(srcRenamer(item));
      const joinVals = pickArr(toQueue.value, tgtKeys);
      let q = groups.get(joinVals);
      if (!q) {
        q = Queue.of(toQueue);
        groups.set(joinVals, q);
      } else {
        q.enqueue(toQueue);
      }
    }

    return Array.from(groups.entries()).map(([_, q]) => q);
  }

  protected *initBidiFrontiers(
    operator: plan.BidirectionalRecursion,
    ctx: ExecutionContext,
    fwdFrontier: Queue<LinkedListNode<unknown[]>>,
    revFrontier: Queue<LinkedListNode<unknown[]>>,
    fwdVisited: Trie<unknown, LinkedListNode<unknown[]>[]>,
    revVisited: Trie<unknown, LinkedListNode<unknown[]>[]>,
    keys: number[],
    initialKeys: number[],
    tgtRenamer: (row: unknown[]) => unknown[],
  ) {
    const first = fwdFrontier.peek();
    ctx.setTuple(first.value, initialKeys);
    ctx.setTuple(first.value, keys);
    for (const toQueue of fwdFrontier) {
      const joinVals = pickArr(toQueue.value, keys);
      fwdVisited.get(joinVals, []).push(toQueue);
    }
    for (const item of operator.target.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      const toQueue = new LinkedListNode<unknown[]>(tgtRenamer(item));
      revFrontier.enqueue(toQueue);
      const joinVals = pickArr(toQueue.value, keys);
      revVisited.get(joinVals, []).push(toQueue);
      const fwdMatches = fwdVisited.get(joinVals);
      if (operator.min <= 1 && fwdMatches) {
        yield* this.joinBidiPaths(
          fwdMatches,
          [toQueue],
          ctx,
          keys,
          initialKeys,
        );
      }
    }
  }

  protected bfsCheckSide(
    queue: Queue<LinkedListNode<unknown[]>>,
    getNextItems: (ctx: ExecutionContext) => Iterable<unknown[]>,
    ctx: ExecutionContext,
    keys: number[],
    initialKeys: number[],
    max: number,
    visitOnly?: Trie<unknown>,
  ) {
    const visited = new Trie<unknown>();
    for (const item of queue) {
      const joinVals = pickArr(item.value, keys);
      if (visitOnly && !visitOnly.has(joinVals)) continue;
      visited.add(joinVals);
    }

    let pathSize = 0;
    while (queue.size > 0) {
      const levelSize = queue.size;
      pathSize++;
      for (let i = 0; i < levelSize; i++) {
        const item = queue.dequeue();
        const arrayed = llToArray(item, keys, initialKeys);
        ctx.setTuple(arrayed, keys);
        ctx.setTuple(arrayed, initialKeys);
        for (const next of getNextItems(ctx)) {
          const result = new LinkedListNode<unknown[]>(next, item);

          const joinVals = pickArr(next, keys);
          if (visited.has(joinVals) || (visitOnly && !visitOnly.has(joinVals)))
            continue;
          if (pathSize <= max) {
            queue.enqueue(result);
            visited.add(joinVals);
          }
        }
      }
    }
    return visited;
  }

  /**
   * Checks if there are any nodes reachable from both frontiers within the remaining path length.
   */
  protected bfsCheck(
    queueFwd: Queue<LinkedListNode<unknown[]>>,
    queueRev: Queue<LinkedListNode<unknown[]>>,
    getNextItemsFwd: (ctx: ExecutionContext) => Iterable<unknown[]>,
    getNextItemsRev: (ctx: ExecutionContext) => Iterable<unknown[]>,
    ctx: ExecutionContext,
    keys: number[],
    initialKeys: number[],
    max: number,
  ): Trie<unknown> {
    const visitedFwd = this.bfsCheckSide(
      queueFwd,
      getNextItemsFwd,
      ctx,
      keys,
      initialKeys,
      max,
    );
    const visitedRev = this.bfsCheckSide(
      queueRev,
      getNextItemsRev,
      ctx,
      keys,
      initialKeys,
      max,
      visitedFwd,
    );

    return visitedRev;
  }

  *visitBidirectionalRecursion(
    operator: plan.BidirectionalRecursion,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    if (operator.min > operator.max || operator.max === 0) return;
    const {
      keys,
      initialKeys,
      fwdRenamer,
      revRenamer,
      tgtRenamer,
      srcRenamer,
    } = this.getBidiKeys(operator, ctx);
    const revFrontier = new Queue<LinkedListNode<unknown[]>>();
    let fwdVisited = new Trie<unknown, LinkedListNode<unknown[]>[]>();
    let revVisited = new Trie<unknown, LinkedListNode<unknown[]>[]>();

    const groups = this.getBidiGroups(operator, ctx, srcRenamer);
    console.log(
      'groups: ',
      groups.map((g) => g.size),
    );

    for (const fwdFrontier of groups) {
      yield* this.initBidiFrontiers(
        operator,
        ctx,
        fwdFrontier,
        revFrontier,
        fwdVisited,
        revVisited,
        keys,
        initialKeys,
        tgtRenamer,
      );
      if (operator.max === 1) return;

      const getFwd = (ctx: ExecutionContext) =>
        Iterator.from(
          operator.mappingFwd.accept(this.vmap, ctx) as Iterable<unknown[]>,
        ).map(fwdRenamer);
      const getRev = (ctx: ExecutionContext) =>
        Iterator.from(
          operator.mappingRev.accept(this.vmap, ctx) as Iterable<unknown[]>,
        ).map(revRenamer);

      let searchSpace: Trie<unknown> = null;

      // If the max depth is large, precompute the search space to avoid exploring impossible paths
      if (operator.max > 4) {
        console.log(
          new Date().toISOString(),
          'Calculating bidirectional recursion search space...',
        );
        searchSpace = this.bfsCheck(
          Queue.from(fwdFrontier),
          Queue.from(revFrontier),
          getFwd,
          getRev,
          ctx,
          keys,
          initialKeys,
          operator.max,
        );
        console.log(
          new Date().toISOString(),
          `Bidi recursion search space size: ${searchSpace.size}`,
        );
        if (searchSpace.size === 0) return;
      }

      let pathSize = 1;
      while (
        (fwdFrontier.size && (revFrontier.size || revVisited.size)) ||
        (revFrontier.size && (fwdFrontier.size || fwdVisited.size))
      ) {
        if (
          fwdFrontier.size > 0 &&
          (revFrontier.size === 0 || fwdFrontier.size <= revFrontier.size)
        ) {
          pathSize++;
          console.log(
            new Date().toISOString(),
            `FWD path size: ${pathSize}, fwd frontier: ${fwdFrontier.size}, rev frontier: ${revFrontier.size} (total: ${fwdFrontier.size + revFrontier.size})`,
          );
          fwdVisited = new Trie();
          yield* this.expandBidiFrontier(
            fwdFrontier,
            revVisited,
            fwdVisited,
            pathSize,
            getFwd,
            ctx,
            operator.min,
            operator.max,
            keys,
            initialKeys,
            true,
            searchSpace,
          );
        }
        if (pathSize >= operator.max) break;
        if (
          revFrontier.size > 0 &&
          (fwdFrontier.size === 0 || revFrontier.size <= fwdFrontier.size)
        ) {
          pathSize++;
          console.log(
            new Date().toISOString(),
            `REV path size: ${pathSize}, fwd frontier: ${fwdFrontier.size}, rev frontier: ${revFrontier.size} (total: ${fwdFrontier.size + revFrontier.size})`,
          );
          revVisited = new Trie();
          yield* this.expandBidiFrontier(
            revFrontier,
            fwdVisited,
            revVisited,
            pathSize,
            getRev,
            ctx,
            operator.min,
            operator.max,
            keys,
            initialKeys,
            false,
            searchSpace,
          );
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
    if (
      ctx.translations.get(operator).scope.get([allAttrs])?.parts[0] === key
    ) {
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

  /**
   * Convert items from a data source into tuples.
   */
  protected generateTuplesFromValues(
    values: Iterable<unknown>,
    operator: PlanTupleOperator,
    ctx: ExecutionContext,
  ): Iterable<unknown[]> {
    throw new Error('Method not implemented.');
  }
}
