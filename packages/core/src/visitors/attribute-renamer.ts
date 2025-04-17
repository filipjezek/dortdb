import {
  IdSet,
  LogicalOpOrId,
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../plan/visitor.js';
import * as plan from '../plan/operators/index.js';
import { DortDBAsFriend } from '../db.js';
import { TransitiveDependencies } from './transitive-deps.js';
import { ASTIdentifier } from '../ast.js';
import { retI0 } from '../internal-fns/index.js';

export class AttributeRenamer implements LogicalPlanVisitor<void> {
  protected tdepsVmap: Record<string, TransitiveDependencies>;
  protected renames: plan.RenameMap;

  constructor(
    protected vmap: Record<string, LogicalPlanVisitor<void>>,
    protected db: DortDBAsFriend,
  ) {
    this.tdepsVmap = this.db.langMgr.getVisitorMap('transitiveDependencies');
  }

  public rename(plan: LogicalPlanOperator, renames: plan.RenameMap) {
    this.renames = renames;
    plan.accept(this.vmap);
    this.tdepsVmap[plan.lang].invalidateCacheUpstream(plan);
  }

  protected processArray(
    array: LogicalOpOrId[],
    deps: IdSet,
    removeDeps = true,
  ) {
    for (const item of array) {
      if (item instanceof ASTIdentifier) {
        if (this.renames.has(item.parts) && deps.has(item.parts)) {
          const newAttr = this.renames.get(item.parts);
          item.parts = newAttr;
        }
      } else {
        item.accept(this.vmap);
      }
    }
    if (removeDeps) {
      for (const [k, v] of this.renames.entries()) {
        if (deps.delete(k)) {
          deps.add(v);
        }
      }
    }
  }

  visitRecursion(operator: plan.Recursion): void {
    operator.source.accept(this.vmap);
    operator.condition.accept(this.vmap);
  }
  visitProjection(operator: plan.Projection): void {
    operator.source.accept(this.vmap);
    this.processArray(operator.attrs.map(retI0), operator.dependencies);
  }
  visitSelection(operator: plan.Selection): void {
    operator.source.accept(this.vmap);
    if (operator.condition instanceof ASTIdentifier) {
      this.processArray([operator.condition], operator.dependencies);
    } else {
      operator.condition.accept(this.vmap);
    }
  }
  visitTupleSource(operator: plan.TupleSource): void {}
  visitItemSource(operator: plan.ItemSource): void {}
  visitFnCall(operator: plan.FnCall): void {
    throw new Error('Method not implemented.');
  }
  visitLiteral(operator: plan.Literal): void {
    throw new Error('Method not implemented.');
  }
  visitCalculation(operator: plan.Calculation): void {
    this.processArray(operator.args, operator.dependencies);
  }
  visitConditional(operator: plan.Conditional): void {
    throw new Error('Method not implemented.');
  }
  visitCartesianProduct(operator: plan.CartesianProduct): void {
    operator.left.accept(this.vmap);
    operator.right.accept(this.vmap);
  }
  visitJoin(operator: plan.Join): void {
    this.visitCartesianProduct(operator);
    this.processArray([operator.on], operator.dependencies);
  }
  visitProjectionConcat(operator: plan.ProjectionConcat): void {
    operator.source.accept(this.vmap);
    this.processArray([operator.mapping], operator.dependencies);
  }
  visitMapToItem(operator: plan.MapToItem): void {
    operator.source.accept(this.vmap);
  }
  visitMapFromItem(operator: plan.MapFromItem): void {
    operator.source.accept(this.vmap);
  }
  visitProjectionIndex(operator: plan.ProjectionIndex): void {
    operator.source.accept(this.vmap);
  }
  visitOrderBy(operator: plan.OrderBy): void {
    operator.source.accept(this.vmap);
    this.processArray(operator.orders.map(plan.getKey), operator.dependencies);
  }
  visitGroupBy(operator: plan.GroupBy): void {
    operator.source.accept(this.vmap);
    this.processArray(operator.keys.map(retI0), operator.dependencies, false);
    this.processArray(operator.aggs, operator.dependencies);
  }
  visitLimit(operator: plan.Limit): void {
    operator.source.accept(this.vmap);
  }
  visitSetOp(operator: plan.SetOperator): void {
    operator.left.accept(this.vmap);
    operator.right.accept(this.vmap);
  }
  visitUnion(operator: plan.Union): void {
    this.visitSetOp(operator);
  }
  visitIntersection(operator: plan.Intersection): void {
    this.visitSetOp(operator);
  }
  visitDifference(operator: plan.Difference): void {
    this.visitSetOp(operator);
  }
  visitDistinct(operator: plan.Distinct): void {
    if (Array.isArray(operator.attrs)) {
      this.processArray(operator.attrs, operator.dependencies);
    }
    operator.source.accept(this.vmap);
  }
  visitNullSource(operator: plan.NullSource): void {}
  visitAggregate(operator: plan.AggregateCall): void {
    operator.postGroupOp.accept(this.vmap);
    this.processArray(operator.args, operator.dependencies);
  }
  visitItemFnSource(operator: plan.ItemFnSource): void {
    this.processArray(operator.args, operator.dependencies);
  }
  visitTupleFnSource(operator: plan.TupleFnSource): void {
    this.processArray(operator.args, operator.dependencies);
  }
  visitQuantifier(operator: plan.Quantifier): void {
    throw new Error('Method not implemented.');
  }
}
