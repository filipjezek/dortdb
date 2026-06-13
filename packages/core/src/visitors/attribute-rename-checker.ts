import {
  Aliased,
  IdSet,
  OpOrId,
  PlanOperator,
  PlanVisitor,
} from '../plan/visitor.js';
import * as plan from '../plan/operators/index.js';
import { DortDBAsFriend } from '../db.js';
import { TransitiveDependencies } from './transitive-deps.js';
import { containsAny, difference, union } from '../utils/trie.js';
import { ASTIdentifier } from '../ast.js';
import { retI0 } from '../internal-fns/index.js';

/**
 * Verifies whether renaming attributes in the plan is safe.
 */
export class AttributeRenameChecker implements PlanVisitor<
  boolean,
  plan.RenameMap
> {
  /** Per-language {@link TransitiveDependencies} visitor map, used to detect rename conflicts. */
  protected tdepsVmap: Record<string, TransitiveDependencies>;

  constructor(
    /** Per-language visitor map used for recursive descent. */
    protected vmap: Record<string, PlanVisitor<boolean, plan.RenameMap>>,
    /** Database instance providing access to the language manager. */
    protected db: DortDBAsFriend,
  ) {
    this.tdepsVmap = this.db.langMgr.getVisitorMap('transitiveDependencies');
  }

  /**
   * Returns `true` if applying `renamesInv` (an inverse rename map) to `plan` is safe,
   * i.e. no attribute referenced in the subtree would be ambiguously renamed.
   */
  public canRename(plan: PlanOperator, renamesInv: plan.RenameMap) {
    return plan.accept(this.vmap, renamesInv);
  }

  /**
   * Checks whether `horizontal` (an expression computed from the current row) can be
   * safely renamed: its transitive dependencies outside `verticalCtx` must not overlap with
   * any renamed attribute, and the expression itself must pass the rename check.
   */
  protected checkHorizontal(
    horizontal: PlanOperator,
    verticalCtx: IdSet,
    renamesInv: plan.RenameMap,
  ) {
    const tdeps = difference(horizontal.accept(this.tdepsVmap), verticalCtx);
    if (containsAny(tdeps, renamesInv)) return false;
    return horizontal.accept(this.vmap, renamesInv);
  }

  /**
   * Calls {@link checkHorizontal} for every non-identifier element of `horizontal`,
   * returning `false` as soon as any element fails the rename check.
   */
  protected checkHorizontalArray(
    horizontal: OpOrId[],
    verticalCtx: IdSet,
    renamesInv: plan.RenameMap,
  ) {
    for (const h of horizontal) {
      if (!(h instanceof ASTIdentifier)) {
        if (!this.checkHorizontal(h, verticalCtx, renamesInv)) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Verifies that none of the projection `attrs` has its output identifier in `renamesInv`
   * (unless it is a trivial identity alias), and that all computed attr expressions pass
   * the horizontal rename check.
   */
  protected checkAttrs(
    attrs: Aliased<ASTIdentifier | plan.Calculation>[],
    verticalCtx: IdSet,
    renamesInv: plan.RenameMap,
  ): boolean {
    return (
      !attrs.some(
        (x) =>
          renamesInv.has(x[1].parts) &&
          (!(x[0] instanceof ASTIdentifier) || !x[0].equals(x[1])),
      ) && this.checkHorizontalArray(attrs.map(retI0), verticalCtx, renamesInv)
    );
  }

  /**
   * Calls the rename check for every non-identifier element of `vertical` (expression
   * arguments), returning `false` as soon as any element fails.
   */
  protected checkVerticalArray(vertical: OpOrId[], renamesInv: plan.RenameMap) {
    for (const v of vertical) {
      if (!(v instanceof ASTIdentifier)) {
        if (!v.accept(this.vmap, renamesInv)) {
          return false;
        }
      }
    }
    return true;
  }

  visitRecursion(
    operator: plan.Recursion,
    renamesInv: plan.RenameMap,
  ): boolean {
    return (
      this.checkHorizontal(
        operator.condition,
        operator.source.schemaSet,
        renamesInv,
      ) &&
      this.checkHorizontalArray(
        operator.distinctKeys,
        operator.source.schemaSet,
        renamesInv,
      ) &&
      operator.source.accept(this.vmap, renamesInv)
    );
  }
  visitProjection(
    operator: plan.Projection,
    renamesInv: plan.RenameMap,
  ): boolean {
    return (
      this.checkAttrs(operator.attrs, operator.source.schemaSet, renamesInv) &&
      operator.source.accept(this.vmap, renamesInv)
    );
  }
  visitSelection(
    operator: plan.Selection,
    renamesInv: plan.RenameMap,
  ): boolean {
    return (
      this.checkHorizontal(
        operator.condition,
        operator.source.schemaSet,
        renamesInv,
      ) && operator.source.accept(this.vmap, renamesInv)
    );
  }
  visitTupleSource(
    operator: plan.TupleSource,
    renamesInv: plan.RenameMap,
  ): boolean {
    return true;
  }
  visitItemSource(
    operator: plan.ItemSource,
    renamesInv: plan.RenameMap,
  ): boolean {
    return true;
  }
  visitFnCall(operator: plan.FnCall, renamesInv: plan.RenameMap): boolean {
    return this.checkVerticalArray(
      operator.args.map((x) => ('op' in x ? x.op : x)),
      renamesInv,
    );
  }
  visitLiteral(operator: plan.Literal, renamesInv: plan.RenameMap): boolean {
    return true;
  }
  visitCalculation(
    operator: plan.Calculation,
    renamesInv: plan.RenameMap,
  ): boolean {
    return this.checkVerticalArray(operator.args, renamesInv);
  }
  visitConditional(
    operator: plan.Conditional,
    renamesInv: plan.RenameMap,
  ): boolean {
    return (
      this.checkVerticalArray(operator.whenThens.flat(), renamesInv) &&
      this.checkVerticalArray(
        [operator.condition, operator.defaultCase].filter((x) => !!x),
        renamesInv,
      )
    );
  }
  visitCartesianProduct(
    operator: plan.CartesianProduct,
    renamesInv: plan.RenameMap,
  ): boolean {
    return (
      operator.left.accept(this.vmap, renamesInv) &&
      operator.right.accept(this.vmap, renamesInv)
    );
  }
  visitJoin(operator: plan.Join, renamesInv: plan.RenameMap): boolean {
    return (
      this.checkHorizontalArray(
        operator.conditions,
        union(operator.left.schemaSet, operator.right.schemaSet),
        renamesInv,
      ) && this.visitCartesianProduct(operator, renamesInv)
    );
  }
  visitProjectionConcat(
    operator: plan.ProjectionConcat,
    renamesInv: plan.RenameMap,
  ): boolean {
    return (
      this.checkHorizontal(
        operator.mapping,
        operator.source.schemaSet,
        renamesInv,
      ) && operator.source.accept(this.vmap, renamesInv)
    );
  }
  visitMapToItem(
    operator: plan.MapToItem,
    renamesInv: plan.RenameMap,
  ): boolean {
    return operator.source.accept(this.vmap, renamesInv);
  }
  visitMapFromItem(
    operator: plan.MapFromItem,
    renamesInv: plan.RenameMap,
  ): boolean {
    return (
      !renamesInv.has(operator.key.parts) &&
      operator.source.accept(this.vmap, renamesInv)
    );
  }
  visitProjectionIndex(
    operator: plan.ProjectionIndex,
    renamesInv: plan.RenameMap,
  ): boolean {
    return (
      !renamesInv.has(operator.indexCol.parts) &&
      operator.source.accept(this.vmap, renamesInv)
    );
  }
  visitOrderBy(operator: plan.OrderBy, renamesInv: plan.RenameMap): boolean {
    return (
      this.checkHorizontalArray(
        operator.orders.map(plan.getKey),
        operator.source.schemaSet,
        renamesInv,
      ) && operator.source.accept(this.vmap, renamesInv)
    );
  }
  visitGroupBy(operator: plan.GroupBy, renamesInv: plan.RenameMap): boolean {
    return (
      this.checkAttrs(operator.keys, operator.source.schemaSet, renamesInv) &&
      this.checkHorizontalArray(
        operator.aggs,
        operator.source.schemaSet,
        renamesInv,
      ) &&
      operator.source.accept(this.vmap, renamesInv)
    );
  }
  visitLimit(operator: plan.Limit, renamesInv: plan.RenameMap): boolean {
    return operator.source.accept(this.vmap, renamesInv);
  }
  protected visitSetOp(
    operator: plan.SetOperator,
    renamesInv: plan.RenameMap,
  ): boolean {
    return (
      operator.left.accept(this.vmap, renamesInv) &&
      operator.right.accept(this.vmap, renamesInv)
    );
  }
  visitUnion(operator: plan.Union, renamesInv: plan.RenameMap): boolean {
    return this.visitSetOp(operator, renamesInv);
  }
  visitIntersection(
    operator: plan.Intersection,
    renamesInv: plan.RenameMap,
  ): boolean {
    return this.visitSetOp(operator, renamesInv);
  }
  visitDifference(
    operator: plan.Difference,
    renamesInv: plan.RenameMap,
  ): boolean {
    return this.visitSetOp(operator, renamesInv);
  }
  visitDistinct(operator: plan.Distinct, renamesInv: plan.RenameMap): boolean {
    if (Array.isArray(operator.attrs)) {
      if (
        !this.checkHorizontalArray(
          operator.attrs,
          operator.source.schemaSet,
          renamesInv,
        )
      )
        return false;
    }
    return operator.source.accept(this.vmap, renamesInv);
  }
  visitNullSource(
    operator: plan.NullSource,
    renamesInv: plan.RenameMap,
  ): boolean {
    return true;
  }
  visitAggregate(
    operator: plan.AggregateCall,
    renamesInv: plan.RenameMap,
  ): boolean {
    return (
      !renamesInv.has(operator.fieldName.parts) &&
      this.checkVerticalArray(operator.args, renamesInv) &&
      operator.postGroupOp.accept(this.vmap, renamesInv)
    );
  }
  visitItemFnSource(
    operator: plan.ItemFnSource,
    renamesInv: plan.RenameMap,
  ): boolean {
    return this.checkVerticalArray(operator.args, renamesInv);
  }
  visitTupleFnSource(
    operator: plan.TupleFnSource,
    renamesInv: plan.RenameMap,
  ): boolean {
    return this.checkVerticalArray(operator.args, renamesInv);
  }
  visitQuantifier(
    operator: plan.Quantifier,
    renamesInv: plan.RenameMap,
  ): boolean {
    return operator.query.accept(this.vmap, renamesInv);
  }
  visitIndexScan(
    operator: plan.IndexScan,
    renamesInv: plan.RenameMap,
  ): boolean {
    return this.checkHorizontal(
      operator.access,
      operator.schemaSet,
      renamesInv,
    );
  }
  visitIndexedRecursion(
    operator: plan.IndexedRecursion,
    renamesInv: plan.RenameMap,
  ): boolean {
    return (
      this.checkHorizontal(
        operator.mapping,
        operator.source.schemaSet,
        renamesInv,
      ) &&
      this.checkHorizontalArray(
        operator.distinctKeys,
        operator.source.schemaSet,
        renamesInv,
      ) &&
      operator.source.accept(this.vmap, renamesInv)
    );
  }
  visitBidirectionalRecursion(
    operator: plan.BidirectionalRecursion,
    renamesInv: plan.RenameMap,
  ): boolean {
    return (
      this.checkHorizontal(
        operator.mappingFwd,
        operator.source.schemaSet,
        renamesInv,
      ) &&
      this.checkHorizontal(
        operator.mappingRev,
        operator.source.schemaSet,
        renamesInv,
      ) &&
      operator.source.accept(this.vmap, renamesInv) &&
      operator.target.accept(this.vmap, renamesInv)
    );
  }
}
