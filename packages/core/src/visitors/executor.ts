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
import { pickArr, ret1, toArray } from '../internal-fns/index.js';
import { Trie } from '../data-structures/trie.js';
import { SerializeFn } from '../lang-manager.js';
import { Queue } from 'mnemonist';
import { LinkedListNode } from '../data-structures/index.js';
import { containsAny, difference } from '../utils/trie.js';
import { TransitiveDependencies } from './transitive-deps.js';
import { HashJoinIndexStatic, IndexMatchInput } from '../indices/index.js';
import { intermediateToCalc } from '../utils/calculation.js';
import { CalculationParams, EqualityChecker } from './index.js';

export interface ExecutorConfig {
  hashJoinIndices: HashJoinIndexStatic[];
}

/**
 * Convert a linked list of arrays into an array of arrays, collecting values for specified keys.
 * @param row Linked list containing the current values.
 * @param keys Keys to extract into collected arrays.
 * @returns Array-like output containing the collected values for each requested key.
 */
export function llToArray(
  row: LinkedListNode<unknown[]>,
  keys: number[],
): unknown[][];
/**
 * Convert a linked list of arrays into an array of arrays, collecting values for specified keys.
 * @param row Linked list containing the current values.
 * @param keys Keys to extract into collected arrays.
 * @param initialKeys Keys contained only in the initial row. Their values are copied directly instead of being wrapped in arrays.
 * @returns Array-like output containing the collected values for each requested key.
 */
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

/**
 * Rename the context item produced by operator A to be usable in operator B.
 * @param keys keys of the operator A
 * @param renames addresses of operator A keys in operator B scope
 * @returns A function that takes an item from operator A and produces an item usable in operator B
 */
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
  protected calcBuilders: Record<string, PlanVisitor<CalculationParams, never>>;
  protected eqCheckers: Record<string, EqualityChecker>;

  protected indexCache: Map<
    PlanTupleOperator,
    [plan.Calculation[], IndexMatchInput[], HashJoinIndexStatic]
  > = new Map();

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
    this.calcBuilders = db.langMgr.getVisitorMap('calculationBuilder');
    this.eqCheckers = db.langMgr.getVisitorMap('equalityChecker');
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
    this.indexCache.clear();
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
    const srcKeys = ctx.getKeys(operator.source);
    const tgtRenamer = makeRenamer(
      srcKeys,
      ctx.getRenames(operator.source, operator),
    );
    const seen = new Trie<unknown>();
    const checkDistinct = operator.distinctKeys.length > 0;

    for (const item of operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      items.push(item);
      const toQueue = new LinkedListNode<unknown[]>([]);
      for (const key of srcKeys) {
        toQueue.value[key] = item[key];
      }
      if (operator.min <= 1 || checkDistinct) {
        const arrayed = ctx.setTuple(llToArray(toQueue, srcKeys), srcKeys);
        if (
          checkDistinct &&
          !this.distinctCheck(operator.distinctKeys, seen, ctx)
        )
          continue;
        if (operator.min <= 1) yield ctx.setTuple(tgtRenamer(arrayed), keys);
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
          const arrayed = llToArray(item, srcKeys);
          for (const key of srcKeys) {
            ctx.variableValues[key] = [arrayed[key], next[key]];
          }
          if (!this.visitCalculation(operator.condition, ctx)[0]) continue;
          if (level >= operator.min || checkDistinct) {
            for (const key of srcKeys) {
              arrayed[key].push(next[key]);
            }
            ctx.setTuple(arrayed, srcKeys);
            if (
              checkDistinct &&
              !this.distinctCheck(operator.distinctKeys, seen, ctx)
            ) {
              continue;
            }
            if (level >= operator.min)
              yield ctx.setTuple(tgtRenamer(arrayed), keys);
          }

          if (level < operator.max) {
            const result = new LinkedListNode<unknown[]>([], item);
            for (const key of srcKeys) {
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
    const srcKeys = ctx.getKeys(operator.source);
    const renameMappedKeys = ctx.getRenames(operator.source, operator.mapping);
    const tgtRenamer = makeRenamer(
      srcKeys,
      ctx.getRenames(operator.source, operator),
    );
    const checkDistinct = operator.distinctKeys.length > 0;
    const seen = new Trie<unknown>();

    for (const item of operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      const toQueue = new LinkedListNode<unknown[]>([]);
      for (const k of srcKeys) {
        toQueue.value[k] = item[k];
      }
      if (operator.min <= 1 || checkDistinct) {
        const arrayed = ctx.setTuple(
          tgtRenamer(llToArray(toQueue, srcKeys)),
          keys,
        );
        if (
          checkDistinct &&
          !this.distinctCheck(operator.distinctKeys, seen, ctx)
        )
          continue;
        if (operator.min <= 1) {
          yield arrayed;
        }
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
        ctx.setTuple(llToArray(item, srcKeys), srcKeys);
        for (const next of operator.mapping.accept(this.vmap, ctx) as Iterable<
          unknown[]
        >) {
          if (level >= operator.min || checkDistinct) {
            let arrayed = llToArray(item, srcKeys);
            for (let i = 0; i < srcKeys.length; i++) {
              arrayed[srcKeys[i]].push(next[renameMappedKeys[i]]);
            }
            arrayed = ctx.setTuple(tgtRenamer(arrayed), keys) as unknown[][];
            if (
              checkDistinct &&
              !this.distinctCheck(operator.distinctKeys, seen, ctx)
            ) {
              continue;
            }
            if (level >= operator.min) yield arrayed;
          }
          if (level < operator.max) {
            const result = new LinkedListNode<unknown[]>([], item);
            for (let i = 0; i < srcKeys.length; i++) {
              result.value[srcKeys[i]] = next[renameMappedKeys[i]];
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
      let pathSize = 1;
      while (
        ((fwdFrontier.size && (revFrontier.size || revVisited.size)) ||
          (revFrontier.size && (fwdFrontier.size || fwdVisited.size))) &&
        pathSize < operator.max
      ) {
        if (pathSize >= 4 && !searchSpace) {
          // If the depth is large, precompute the search space to avoid exploring impossible paths
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
          continue;
        }
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
      yield* this.visitInnerJoin(operator, ctx);
    } else if (operator.leftOuter && !operator.rightOuter) {
      yield* this.visitLeftJoin(operator.left, operator.right, operator, ctx);
    } else if (!operator.leftOuter && operator.rightOuter) {
      yield* this.visitLeftJoin(operator.right, operator.left, operator, ctx);
    } else {
      yield* this.visitFullJoin(operator, ctx);
    }
  }
  protected *visitInnerJoin(
    operator: plan.Join,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const rightKeys = ctx.getKeys(operator.right);
    const leftKeys = ctx.getKeys(operator.left);
    const renameRightKeys = ctx.getRenames(operator.right, operator);
    const resultKeys = ctx.getKeys(operator);
    const [conditions, pairs] = this.joinValues(
      operator.left,
      operator.right,
      operator,
      ctx,
    );

    for (const [leftItem, rightItems] of pairs) {
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
            return ctx.setTuple(result, resultKeys);
          })
          .filter(() =>
            conditions.every((c) => this.visitCalculation(c, ctx)[0]),
          ),
      );
    }
  }
  protected *visitLeftJoin(
    left: PlanTupleOperator,
    right: PlanTupleOperator,
    op: plan.Join,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const rightKeys = ctx.getKeys(right);
    const leftKeys = ctx.getKeys(left);
    const renameRightKeys = ctx.getRenames(right, op);
    const resultKeys = ctx.getKeys(op);
    const [conditions, pairs] = this.joinValues(left, right, op, ctx);

    for (const [leftItem, rightItems] of pairs) {
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
    const rightKeys = ctx.getKeys(operator.right);
    const leftKeys = ctx.getKeys(operator.left);
    const renameRightKeys = ctx.getRenames(operator.right, operator);
    const resultKeys = ctx.getKeys(operator);
    const [conditions, pairs, rightAllItems] = this.joinValues(
      operator.left,
      operator.right,
      operator,
      ctx,
    );
    const rightSet = new Set(rightAllItems);

    for (const [leftItem, rightItems] of pairs) {
      let joined = false;
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
            if (conditions.every((c) => this.visitCalculation(c, ctx)[0])) {
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

  /**
   * Joins can be executed in different ways depending on the join conditions.
   * This method determines the best way to execute the join and returns the remaining conditions to check and values.
   * @param iterOnce the branch that is the outer iteration loop
   * @param iterPerRow the branch that is the inner iteration loop
   * @param op the join operator
   * @returns [remaining conditions, iterable of [outer item, array of matching inner items], all inner items]
   */
  protected joinValues(
    iterOnce: PlanTupleOperator,
    iterPerRow: PlanTupleOperator,
    op: plan.Join,
    ctx: ExecutionContext,
  ): [
    plan.Calculation[],
    Iterable<[unknown[], unknown[][]]>,
    Iterable<unknown[]>,
  ] {
    const bestIndex = this.getBestJoinIndex(iterOnce, iterPerRow, op, ctx);
    if (bestIndex) {
      return this.hashJoinValues(iterOnce, iterPerRow, op, ctx, ...bestIndex);
    }

    return [
      op.conditions,
      ...this.nestedLoopJoinValues(iterOnce, iterPerRow, ctx),
    ];
  }

  protected hashJoinValues(
    iterOnce: PlanTupleOperator,
    iterPerRow: PlanTupleOperator,
    op: plan.Join,
    ctx: ExecutionContext,
    indexInputCalcs: plan.Calculation[],
    indexMatchInputs: IndexMatchInput[],
    idxCls: HashJoinIndexStatic,
  ): [
    plan.Calculation[],
    Iterable<[unknown[], unknown[][]]>,
    Iterable<unknown[]>,
  ] {
    const idx = new idxCls(indexInputCalcs, this.db);
    const accessor = idx.createAccessor(indexMatchInputs);
    accessor.args.forEach((arg, i) => {
      if (arg instanceof ASTIdentifier) {
        accessor.args[i] = ASTIdentifier.fromParts([
          ctx.getTranslation(op, arg.parts),
        ]);
      }
    });

    const conds = op.conditions.filter(
      (c) => !indexMatchInputs.some((imi) => imi.containingFn === c.original),
    );

    const iterPerRowIter = Iterator.from(
      iterPerRow.accept(this.vmap, ctx) as Iterable<unknown[]>,
    );
    idx.reindex(
      iterPerRowIter.map((row) => ({
        value: row,
        keys: indexInputCalcs.map((c) => this.visitCalculation(c, ctx)[0]),
      })),
    );

    const iterOnceIter = Iterator.from(
      iterOnce.accept(this.vmap, ctx) as Iterable<unknown[]>,
    );
    return [
      conds,
      iterOnceIter.map((onceItem) => {
        const accessed = this.visitCalculation(accessor, ctx)[0] as unknown[][];
        return [onceItem, accessed];
      }),
      idx.allValues(),
    ];
  }

  /**
   * Get all function calls with at least one argument that does not depend on the iterOnce side of the join.
   */
  protected getIndexMatchInputs(
    iterOnce: PlanTupleOperator,
    op: plan.Join,
  ): (IndexMatchInput & { i: number })[] {
    return op.conditions
      .filter((c) => c.original instanceof plan.FnCall)
      .flatMap((c) =>
        (c.original as plan.FnCall).args.map((arg, i) => ({
          expr: arg instanceof ASTIdentifier ? arg : arg.op,
          containingFn: c.original as plan.FnCall,
          i,
        })),
      )
      .filter(({ expr }) => {
        if (expr instanceof ASTIdentifier)
          return !iterOnce.schemaSet.has(expr.parts);
        return !containsAny(iterOnce.schemaSet, expr.accept(this.tdeps));
      });
  }

  /**
   * From the potentially indexable expressions, find those that can be indexed by an available index.
   * Futhermore, verify that the non-indexable parts of the condition do not depend on the iterPerRow side
   */
  protected findIndexableExpressions(
    indexMatchInputs: (IndexMatchInput & { i: number })[],
    iterPerRow: PlanTupleOperator,
  ) {
    return this.db.config.executor?.hashJoinIndices
      .map((idx) => {
        let matches = idx.canIndex(indexMatchInputs);
        matches = matches?.filter((mi) => {
          const fn = indexMatchInputs[mi].containingFn;
          for (let ai = 0; ai < fn.args.length; ai++) {
            if (
              matches.some(
                (imii) =>
                  indexMatchInputs[imii].i === ai &&
                  indexMatchInputs[imii].containingFn === fn,
              )
            )
              continue;
            const arg = fn.args[ai];
            if (arg instanceof ASTIdentifier) {
              if (iterPerRow.schemaSet.has(arg.parts)) return false;
            } else {
              if (containsAny(iterPerRow.schemaSet, arg.op.accept(this.tdeps)))
                return false;
            }
          }
          return true;
        });
        return [matches ?? [], idx] as const;
      })
      .filter(([matches]) => matches.length > 0);
  }

  protected getBestJoinIndex(
    iterOnce: PlanTupleOperator,
    iterPerRow: PlanTupleOperator,
    op: plan.Join,
    ctx: ExecutionContext,
  ): [plan.Calculation[], IndexMatchInput[], HashJoinIndexStatic] {
    if (this.indexCache.has(op)) return this.indexCache.get(op);
    if (this.db.config.executor?.hashJoinIndices === undefined) return null;

    const indexMatchInputs = this.getIndexMatchInputs(iterOnce, op);

    const indexable = this.findIndexableExpressions(
      indexMatchInputs,
      iterPerRow,
    );

    if (!indexable?.length) return null;
    let best = indexable[0];
    for (let i = 1; i < indexable.length; i++) {
      if (indexable[i][0].length > best[0].length) {
        best = indexable[i];
      }
    }

    const calcs = best[0].map((imi) => {
      const expr = indexMatchInputs[imi].expr;
      return intermediateToCalc(
        expr instanceof ASTIdentifier
          ? new plan.FnCall(op.lang, [expr], ret1)
          : expr,
        this.calcBuilders,
        this.eqCheckers,
      );
    });
    for (const calc of calcs) {
      calc.args.forEach((arg, i) => {
        if (arg instanceof ASTIdentifier) {
          calc.args[i] = ASTIdentifier.fromParts([
            ctx.getTranslation(op, arg.parts),
          ]);
        }
      });
    }
    const res = [calcs, best[0].map((i) => indexMatchInputs[i]), best[1]] as [
      plan.Calculation[],
      IndexMatchInput[],
      HashJoinIndexStatic,
    ];
    this.indexCache.set(op, res);
    return res;
  }

  protected nestedLoopJoinValues(
    iterOnce: PlanTupleOperator,
    iterPerRow: PlanTupleOperator,
    ctx: ExecutionContext,
  ): [Iterable<[unknown[], unknown[][]]>, Iterable<unknown[]>] {
    const iterPerRowItems = toArray(
      iterPerRow.accept(this.vmap, ctx),
    ) as unknown[][];
    const iterOnceIter = Iterator.from(
      iterOnce.accept(this.vmap, ctx) as Iterable<unknown[]>,
    );
    return [
      iterOnceIter.map((onceItem) => [onceItem, iterPerRowItems]),
      iterPerRowItems,
    ];
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

  /** Validates that an operator returns only a single value */
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
    // prepare the lambdas so that we do not have to rapidly create them for every item in the group
    const checkNull = this.prepareAggNullChecks(operator, ctx);

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
        const skipNulls = !agg.impl.includeNulls;
        for (const item of agg.postGroupOp.accept(this.vmap, ctx)) {
          const vals = agg.args.map((a) => this.processItem(a, ctx));
          if (skipNulls && vals.some(checkNull[i])) {
            continue;
          }
          state = agg.impl.step(state, ...vals);
        }
        result[agg.fieldName.parts[0] as number] = agg.impl.result(state);
      }
      yield ctx.setTuple(result, resultKeys);
    }
    for (let i = 0; i < operator.aggs.length; i++) {
      operator.aggs[i].postGroupSource.accept = originalAggAcepts[i];
    }
  }

  protected prepareAggNullChecks(
    operator: plan.GroupBy,
    ctx: ExecutionContext,
  ) {
    const skipNullChecks = operator.aggs.map((agg) => {
      const invTranslations: (string | symbol | number)[] = [];
      for (const [id, num] of ctx.translations
        .get(agg.postGroupSource)
        .scope.entries()) {
        invTranslations[num.parts[0] as number] = id.at(-1);
      }
      return agg.args.map(
        (a) =>
          a instanceof ASTIdentifier &&
          invTranslations[a.parts[0] as number] === allAttrs,
      );
    });
    return operator.aggs.map(
      (agg, i) => (x: any, j: number) =>
        (x === null || x === undefined) && !skipNullChecks[i][j],
    );
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

  /**
   * Create a wrapper around a stream of tuples that ensures only distinct combinations of values for the specified keys are produced.
   */
  protected *distinctStream(
    stream: Iterable<unknown[]>,
    keys: (plan.Calculation | ASTIdentifier)[],
    seen: Trie<unknown>,
    ctx: ExecutionContext,
  ): Iterable<unknown[]> {
    for (const item of stream) {
      if (this.distinctCheck(keys, seen, ctx)) yield item;
    }
  }

  /**
   * Check if an item loaded in the current context is included in the distinct output for the specified keys.
   * If so, it is added to the seen set.
   */
  protected distinctCheck(
    keys: (plan.Calculation | ASTIdentifier)[],
    seen: Trie<unknown>,
    ctx: ExecutionContext,
  ): boolean {
    const values = keys.map((attr) => this.processItem(attr, ctx));
    if (seen.has(values)) {
      return false;
    }
    seen.add(values);
    return true;
  }

  visitDistinct(
    operator: plan.Distinct,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const seen = new Trie<unknown>();
    const src = operator.source.accept(this.vmap, ctx) as Iterable<unknown[]>;
    const keys =
      operator.attrs === allAttrs
        ? ctx.getKeys(operator).map((x) => ASTIdentifier.fromParts([x]))
        : operator.attrs;
    return this.distinctStream(src, keys, seen, ctx);
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
