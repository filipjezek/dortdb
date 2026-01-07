import { IdSet, OpOrId, PlanOperator, PlanVisitor } from '../plan/visitor.js';
import * as plan from '../plan/operators/index.js';
import { DortDBAsFriend } from '../db.js';
import { TransitiveDependencies } from './transitive-deps.js';
import { ASTIdentifier } from '../ast.js';
import { retI0 } from '../internal-fns/index.js';

/**
 * Renames attributes in the plan.
 */
export class AttributeRenamer implements PlanVisitor<void, plan.RenameMap> {
  protected tdepsVmap: Record<string, TransitiveDependencies>;

  constructor(
    protected vmap: Record<string, PlanVisitor<void, plan.RenameMap>>,
    protected db: DortDBAsFriend,
  ) {
    this.tdepsVmap = this.db.langMgr.getVisitorMap('transitiveDependencies');
  }

  public rename(plan: PlanOperator, renames: plan.RenameMap) {
    plan.accept(this.vmap, renames);
    this.tdepsVmap[plan.lang].invalidateCacheUpstream(plan);
  }

  protected processArray(
    array: OpOrId[],
    deps: IdSet,
    renames: plan.RenameMap,
    updateFn?: (newId: ASTIdentifier, i: number) => void,
    removeDeps = true,
  ) {
    for (let i = 0; i < array.length; i++) {
      const item = array[i];
      if (item instanceof ASTIdentifier) {
        const fromRenames = renames.get(item.parts);
        if (fromRenames && deps.has(item.parts)) {
          const newAttr = ASTIdentifier.fromParts(fromRenames);
          if (updateFn) {
            updateFn(newAttr, i);
          } else {
            array[i] = newAttr;
          }
        }
      } else {
        item.accept(this.vmap, renames);
      }
    }
    if (removeDeps) {
      for (const [k, v] of renames.entries()) {
        if (deps.delete(k)) {
          deps.add(v);
        }
      }
    }
  }

  protected processItem<Key extends string, Obj extends Record<Key, OpOrId>>(
    obj: Obj,
    key: Key,
    deps: IdSet,
    renames: plan.RenameMap,
    removeDeps = true,
  ) {
    const item = obj[key];
    if (item instanceof ASTIdentifier) {
      if (renames.has(item.parts) && deps.has(item.parts)) {
        const newAttr = renames.get(item.parts);
        obj[key] = ASTIdentifier.fromParts(newAttr) as Obj[Key];
      }
    } else {
      item.accept(this.vmap, renames);
    }
    if (removeDeps) {
      for (const [k, v] of renames.entries()) {
        if (deps.delete(k)) {
          deps.add(v);
        }
      }
    }
  }

  visitRecursion(operator: plan.Recursion, renames: plan.RenameMap): void {
    operator.source.accept(this.vmap, renames);
    operator.condition.accept(this.vmap, renames);
  }
  visitProjection(operator: plan.Projection, renames: plan.RenameMap): void {
    operator.source.accept(this.vmap, renames);
    this.processArray(
      operator.attrs.map(retI0),
      operator.dependencies,
      renames,
      (id, i) => (operator.attrs[i][0] = id),
      true,
    );
  }
  visitSelection(operator: plan.Selection, renames: plan.RenameMap): void {
    operator.source.accept(this.vmap, renames);
    operator.condition.accept(this.vmap, renames);
  }
  visitTupleSource(operator: plan.TupleSource, renames: plan.RenameMap): void {}
  visitItemSource(operator: plan.ItemSource, renames: plan.RenameMap): void {}
  visitFnCall(operator: plan.FnCall, renames: plan.RenameMap): void {
    this.processArray(
      operator.args.map((a) => ('op' in a ? a.op : a)),
      operator.dependencies,
      renames,
      (id, i) => (operator.args[i] = id),
    );
  }
  visitLiteral(operator: plan.Literal, renames: plan.RenameMap): void {
    return;
  }
  visitCalculation(operator: plan.Calculation, renames: plan.RenameMap): void {
    this.processArray(operator.args, operator.dependencies, renames);
    if (operator.original) {
      operator.original.accept(this.vmap, renames);
    }
  }
  visitConditional(operator: plan.Conditional, renames: plan.RenameMap): void {
    for (const key of ['condition', 'defaultCase'] as const) {
      const item = operator[key];
      if (item instanceof ASTIdentifier) {
        const fromRenames = renames.get(item.parts);
        if (fromRenames) {
          const newAttr = ASTIdentifier.fromParts(fromRenames);
          operator[key] = newAttr;
        }
      } else {
        item.accept(this.vmap, renames);
      }
    }

    this.processArray(
      operator.whenThens.flat(),
      operator.dependencies,
      renames,
      (id, i) => (operator.whenThens[Math.floor(i / 2)][i % 2] = id),
    );
  }
  visitCartesianProduct(
    operator: plan.CartesianProduct,
    renames: plan.RenameMap,
  ): void {
    operator.left.accept(this.vmap, renames);
    operator.right.accept(this.vmap, renames);
  }
  visitJoin(operator: plan.Join, renames: plan.RenameMap): void {
    this.visitCartesianProduct(operator, renames);
    this.processArray(operator.conditions, operator.dependencies, renames);
  }
  visitProjectionConcat(
    operator: plan.ProjectionConcat,
    renames: plan.RenameMap,
  ): void {
    operator.source.accept(this.vmap, renames);
    this.processItem(operator, 'mapping', operator.dependencies, renames);
  }
  visitMapToItem(operator: plan.MapToItem, renames: plan.RenameMap): void {
    operator.source.accept(this.vmap, renames);
  }
  visitMapFromItem(operator: plan.MapFromItem, renames: plan.RenameMap): void {
    operator.source.accept(this.vmap, renames);
  }
  visitProjectionIndex(
    operator: plan.ProjectionIndex,
    renames: plan.RenameMap,
  ): void {
    operator.source.accept(this.vmap, renames);
  }
  visitOrderBy(operator: plan.OrderBy, renames: plan.RenameMap): void {
    operator.source.accept(this.vmap, renames);
    this.processArray(
      operator.orders.map(plan.getKey),
      operator.dependencies,
      renames,
      (id, i) => (operator.orders[i].key = id),
    );
  }
  visitGroupBy(operator: plan.GroupBy, renames: plan.RenameMap): void {
    operator.source.accept(this.vmap, renames);
    this.processArray(
      operator.keys.map(retI0),
      operator.dependencies,
      renames,
      (id, i) => (operator.keys[i][0] = id),
      false,
    );
    this.processArray(operator.aggs, operator.dependencies, renames);
  }
  visitLimit(operator: plan.Limit, renames: plan.RenameMap): void {
    operator.source.accept(this.vmap, renames);
  }
  visitSetOp(operator: plan.SetOperator, renames: plan.RenameMap): void {
    operator.left.accept(this.vmap, renames);
    operator.right.accept(this.vmap, renames);
  }
  visitUnion(operator: plan.Union, renames: plan.RenameMap): void {
    this.visitSetOp(operator, renames);
  }
  visitIntersection(
    operator: plan.Intersection,
    renames: plan.RenameMap,
  ): void {
    this.visitSetOp(operator, renames);
  }
  visitDifference(operator: plan.Difference, renames: plan.RenameMap): void {
    this.visitSetOp(operator, renames);
  }
  visitDistinct(operator: plan.Distinct, renames: plan.RenameMap): void {
    if (Array.isArray(operator.attrs)) {
      this.processArray(operator.attrs, operator.dependencies, renames);
    }
    operator.source.accept(this.vmap, renames);
  }
  visitNullSource(operator: plan.NullSource, renames: plan.RenameMap): void {}
  visitAggregate(operator: plan.AggregateCall, renames: plan.RenameMap): void {
    operator.postGroupOp.accept(this.vmap, renames);
    this.processArray(operator.args, operator.dependencies, renames);
  }
  visitItemFnSource(
    operator: plan.ItemFnSource,
    renames: plan.RenameMap,
  ): void {
    this.processArray(operator.args, operator.dependencies, renames);
  }
  visitTupleFnSource(
    operator: plan.TupleFnSource,
    renames: plan.RenameMap,
  ): void {
    this.processArray(operator.args, operator.dependencies, renames);
  }
  visitQuantifier(operator: plan.Quantifier, renames: plan.RenameMap): void {
    operator.query.accept(this.vmap, renames);
  }
  visitIndexScan(operator: plan.IndexScan, renames: plan.RenameMap): void {
    operator.access.accept(this.vmap, renames);
  }
  visitIndexedRecursion(
    operator: plan.IndexedRecursion,
    renames: plan.RenameMap,
  ): void {
    operator.source.accept(this.vmap, renames);
    this.processItem(operator, 'mapping', operator.dependencies, renames);
  }
  visitBidirectionalRecursion(
    operator: plan.BidirectionalRecursion,
    renames: plan.RenameMap,
  ): void {
    operator.source.accept(this.vmap, renames);
    operator.target.accept(this.vmap, renames);
    this.processItem(operator, 'mappingFwd', operator.dependencies, renames);
    this.processItem(operator, 'mappingRev', operator.dependencies, renames);
  }
}
