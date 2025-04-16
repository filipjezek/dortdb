import {
  IdSet,
  LogicalOpOrId,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '../plan/visitor.js';
import * as plan from '../plan/operators/index.js';
import { DortDBAsFriend } from '../db.js';
import { TransitiveDependencies } from './transitive-deps.js';
import { containsAny, difference, union } from '../utils/trie.js';
import { ASTIdentifier } from '../ast.js';
import { retI0 } from '../internal-fns/index.js';

export class AttributeRenameChecker implements LogicalPlanVisitor<boolean> {
  protected renamesInv: plan.RenameMap;
  protected tdepsVmap: Record<string, TransitiveDependencies>;

  constructor(
    protected vmap: Record<string, LogicalPlanVisitor<boolean>>,
    protected db: DortDBAsFriend,
  ) {
    this.tdepsVmap = this.db.langMgr.getVisitorMap('transitiveDependencies');
  }

  public canRename(plan: LogicalPlanOperator, renamesInv: plan.RenameMap) {
    this.renamesInv = renamesInv;
    console.log('canRename', plan, renamesInv);
    return plan.accept(this.vmap);
  }

  protected checkHorizontal(
    horizontal: LogicalPlanOperator,
    verticalCtx: IdSet,
  ) {
    const tdeps = difference(horizontal.accept(this.tdepsVmap), verticalCtx);
    if (containsAny(tdeps, this.renamesInv)) return false;
    return horizontal.accept(this.vmap);
  }

  protected checkHorizontalArray(
    horizontal: LogicalOpOrId[],
    verticalCtx: IdSet,
  ) {
    for (const h of horizontal) {
      if (!(h instanceof ASTIdentifier)) {
        if (!this.checkHorizontal(h, verticalCtx)) {
          return false;
        }
      }
    }
    return true;
  }

  protected checkVerticalArray(vertical: LogicalOpOrId[]) {
    for (const v of vertical) {
      if (!(v instanceof ASTIdentifier)) {
        if (!v.accept(this.vmap)) {
          console.log('checkVerticalArray failed', v);
          return false;
        }
      }
    }
    console.log('checkVerticalArray ok');
    return true;
  }

  visitRecursion(operator: plan.Recursion): boolean {
    return (
      this.checkHorizontal(operator.condition, operator.source.schemaSet) &&
      operator.source.accept(this.vmap)
    );
  }
  visitProjection(operator: plan.Projection): boolean {
    return (
      this.checkHorizontalArray(
        operator.attrs.map(retI0),
        operator.source.schemaSet,
      ) && operator.source.accept(this.vmap)
    );
  }
  visitSelection(operator: plan.Selection): boolean {
    return (
      (operator.condition instanceof plan.Calculation
        ? this.checkHorizontal(operator.condition, operator.source.schemaSet)
        : true) && operator.source.accept(this.vmap)
    );
  }
  visitTupleSource(operator: plan.TupleSource): boolean {
    return true;
  }
  visitItemSource(operator: plan.ItemSource): boolean {
    return true;
  }
  visitFnCall(operator: plan.FnCall): boolean {
    throw new Error('Method not implemented.');
  }
  visitLiteral(operator: plan.Literal): boolean {
    throw new Error('Method not implemented.');
  }
  visitCalculation(operator: plan.Calculation): boolean {
    return this.checkVerticalArray(operator.args);
  }
  visitConditional(operator: plan.Conditional): boolean {
    throw new Error('Method not implemented.');
  }
  visitCartesianProduct(operator: plan.CartesianProduct): boolean {
    return operator.left.accept(this.vmap) && operator.right.accept(this.vmap);
  }
  visitJoin(operator: plan.Join): boolean {
    return (
      this.checkHorizontal(
        operator.on,
        union(operator.left.schemaSet, operator.right.schemaSet),
      ) && this.visitCartesianProduct(operator)
    );
  }
  visitProjectionConcat(operator: plan.ProjectionConcat): boolean {
    return (
      this.checkHorizontal(operator.mapping, operator.source.schemaSet) &&
      operator.source.accept(this.vmap)
    );
  }
  visitMapToItem(operator: plan.MapToItem): boolean {
    return operator.source.accept(this.vmap);
  }
  visitMapFromItem(operator: plan.MapFromItem): boolean {
    return operator.source.accept(this.vmap);
  }
  visitProjectionIndex(operator: plan.ProjectionIndex): boolean {
    return operator.source.accept(this.vmap);
  }
  visitOrderBy(operator: plan.OrderBy): boolean {
    return (
      this.checkHorizontalArray(
        operator.orders.map(plan.getKey),
        operator.source.schemaSet,
      ) && operator.source.accept(this.vmap)
    );
  }
  visitGroupBy(operator: plan.GroupBy): boolean {
    return (
      this.checkHorizontalArray(
        operator.keys.map(retI0),
        operator.source.schemaSet,
      ) &&
      this.checkHorizontalArray(operator.aggs, operator.source.schemaSet) &&
      operator.source.accept(this.vmap)
    );
  }
  visitLimit(operator: plan.Limit): boolean {
    return operator.source.accept(this.vmap);
  }
  protected visitSetOp(operator: plan.SetOperator): boolean {
    return operator.left.accept(this.vmap) && operator.right.accept(this.vmap);
  }
  visitUnion(operator: plan.Union): boolean {
    return this.visitSetOp(operator);
  }
  visitIntersection(operator: plan.Intersection): boolean {
    return this.visitSetOp(operator);
  }
  visitDifference(operator: plan.Difference): boolean {
    return this.visitSetOp(operator);
  }
  visitDistinct(operator: plan.Distinct): boolean {
    if (Array.isArray(operator.attrs)) {
      if (!this.checkHorizontalArray(operator.attrs, operator.source.schemaSet))
        return false;
    }
    return operator.source.accept(this.vmap);
  }
  visitNullSource(operator: plan.NullSource): boolean {
    return true;
  }
  visitAggregate(operator: plan.AggregateCall): boolean {
    return (
      this.checkVerticalArray(operator.args) &&
      operator.postGroupOp.accept(this.vmap)
    );
  }
  visitItemFnSource(operator: plan.ItemFnSource): boolean {
    return this.checkVerticalArray(operator.args);
  }
  visitTupleFnSource(operator: plan.TupleFnSource): boolean {
    return this.checkVerticalArray(operator.args);
  }
  visitQuantifier(operator: plan.Quantifier): boolean {
    throw new Error('Method not implemented.');
  }
}
