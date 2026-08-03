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
import { containsAny, difference, invert, union } from '../utils/trie.js';
import { ASTIdentifier } from '../ast.js';
import { retI0 } from '../internal-fns/index.js';

/**
 * Arguments threaded through the rename checking visitor during recursive descent.
 */
export interface ArcDescentArgs {
  /** Rename map to be checked */
  renames: plan.RenameMap;
  /** Inverse rename map to be checked */
  renamesInv: plan.RenameMap;
}

/**
 * Verifies whether renaming attributes in the plan is safe.
 */
export class AttributeRenameChecker implements PlanVisitor<
  boolean,
  ArcDescentArgs
> {
  /** Per-language {@link TransitiveDependencies} visitor map, used to detect rename conflicts. */
  protected tdepsVmap: Record<string, TransitiveDependencies>;

  constructor(
    /** Per-language visitor map used for recursive descent. */
    protected vmap: Record<string, PlanVisitor<boolean, ArcDescentArgs>>,
    /** Database instance providing access to the language manager. */
    protected db: DortDBAsFriend,
  ) {
    this.tdepsVmap = this.db.langMgr.getVisitorMap('transitiveDependencies');
  }

  /**
   * Returns `true` if applying `args` (an inverse rename map) to `plan` is safe,
   * i.e. no attribute referenced in the subtree would be ambiguously renamed.
   */
  public canRename(plan: PlanOperator, renamesInv: plan.RenameMap): boolean {
    const renames = invert(renamesInv);
    const res = plan.accept(this.vmap, { renames, renamesInv });
    return res;
  }

  /**
   * Checks whether `horizontal` (an expression computed from the current row) can be
   * safely renamed: its transitive dependencies outside `verticalCtx` must not overlap with
   * any renamed attribute, and the expression itself must pass the rename check.
   */
  protected checkHorizontal(
    horizontal: PlanOperator,
    verticalCtx: IdSet,
    args: ArcDescentArgs,
  ) {
    const tdeps = difference(horizontal.accept(this.tdepsVmap), verticalCtx);
    if (
      containsAny(tdeps, args.renamesInv) ||
      (containsAny(tdeps, args.renames) &&
        containsAny(verticalCtx, args.renamesInv))
    )
      return false;
    return horizontal.accept(this.vmap, args);
  }

  /**
   * Calls {@link checkHorizontal} for every non-identifier element of `horizontal`,
   * returning `false` as soon as any element fails the rename check.
   */
  protected checkHorizontalArray(
    horizontal: OpOrId[],
    verticalCtx: IdSet,
    args: ArcDescentArgs,
  ) {
    for (const h of horizontal) {
      if (!(h instanceof ASTIdentifier)) {
        if (!this.checkHorizontal(h, verticalCtx, args)) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Verifies that none of the projection `attrs` has its output identifier in `args`
   * (unless it is a trivial identity alias), and that all computed attr expressions pass
   * the horizontal rename check.
   */
  protected checkAttrs(
    attrs: Aliased<ASTIdentifier | plan.Calculation>[],
    verticalCtx: IdSet,
    args: ArcDescentArgs,
  ): boolean {
    return (
      !attrs.some(
        (x) =>
          args.renamesInv.has(x[1].parts) &&
          (!(x[0] instanceof ASTIdentifier) || !x[0].equals(x[1])),
      ) && this.checkHorizontalArray(attrs.map(retI0), verticalCtx, args)
    );
  }

  /**
   * Calls the rename check for every non-identifier element of `vertical` (expression
   * arguments), returning `false` as soon as any element fails.
   */
  protected checkVerticalArray(vertical: OpOrId[], args: ArcDescentArgs) {
    for (const v of vertical) {
      if (!(v instanceof ASTIdentifier)) {
        if (!v.accept(this.vmap, args)) {
          return false;
        }
      }
    }
    return true;
  }

  visitRecursion(operator: plan.Recursion, args: ArcDescentArgs): boolean {
    return (
      this.checkHorizontal(
        operator.condition,
        operator.source.schemaSet,
        args,
      ) &&
      this.checkHorizontalArray(
        operator.distinctKeys,
        operator.source.schemaSet,
        args,
      ) &&
      operator.source.accept(this.vmap, args)
    );
  }
  visitProjection(operator: plan.Projection, args: ArcDescentArgs): boolean {
    return (
      this.checkAttrs(operator.attrs, operator.source.schemaSet, args) &&
      operator.source.accept(this.vmap, args)
    );
  }
  visitSelection(operator: plan.Selection, args: ArcDescentArgs): boolean {
    return (
      this.checkHorizontal(
        operator.condition,
        operator.source.schemaSet,
        args,
      ) && operator.source.accept(this.vmap, args)
    );
  }
  visitTupleSource(operator: plan.TupleSource, args: ArcDescentArgs): boolean {
    return true;
  }
  visitItemSource(operator: plan.ItemSource, args: ArcDescentArgs): boolean {
    return true;
  }
  visitFnCall(operator: plan.FnCall, args: ArcDescentArgs): boolean {
    return this.checkVerticalArray(
      operator.args.map((x) => ('op' in x ? x.op : x)),
      args,
    );
  }
  visitLiteral(operator: plan.Literal, args: ArcDescentArgs): boolean {
    return true;
  }
  visitCalculation(operator: plan.Calculation, args: ArcDescentArgs): boolean {
    return this.checkVerticalArray(operator.args, args);
  }
  visitConditional(operator: plan.Conditional, args: ArcDescentArgs): boolean {
    return (
      this.checkVerticalArray(operator.whenThens.flat(), args) &&
      this.checkVerticalArray(
        [operator.condition, operator.defaultCase].filter((x) => !!x),
        args,
      )
    );
  }
  visitCartesianProduct(
    operator: plan.CartesianProduct,
    args: ArcDescentArgs,
  ): boolean {
    return (
      operator.left.accept(this.vmap, args) &&
      operator.right.accept(this.vmap, args)
    );
  }
  visitJoin(operator: plan.Join, args: ArcDescentArgs): boolean {
    return (
      this.checkHorizontalArray(
        operator.conditions,
        union(operator.left.schemaSet, operator.right.schemaSet),
        args,
      ) && this.visitCartesianProduct(operator, args)
    );
  }
  visitProjectionConcat(
    operator: plan.ProjectionConcat,
    args: ArcDescentArgs,
  ): boolean {
    return (
      this.checkHorizontal(operator.mapping, operator.source.schemaSet, args) &&
      operator.source.accept(this.vmap, args)
    );
  }
  visitMapToItem(operator: plan.MapToItem, args: ArcDescentArgs): boolean {
    return operator.source.accept(this.vmap, args);
  }
  visitMapFromItem(operator: plan.MapFromItem, args: ArcDescentArgs): boolean {
    return (
      !args.renamesInv.has(operator.key.parts) &&
      operator.source.accept(this.vmap, args)
    );
  }
  visitProjectionIndex(
    operator: plan.ProjectionIndex,
    args: ArcDescentArgs,
  ): boolean {
    return (
      !args.renamesInv.has(operator.indexCol.parts) &&
      operator.source.accept(this.vmap, args)
    );
  }
  visitOrderBy(operator: plan.OrderBy, args: ArcDescentArgs): boolean {
    return (
      this.checkHorizontalArray(
        operator.orders.map(plan.getKey),
        operator.source.schemaSet,
        args,
      ) && operator.source.accept(this.vmap, args)
    );
  }
  visitGroupBy(operator: plan.GroupBy, args: ArcDescentArgs): boolean {
    return (
      this.checkAttrs(operator.keys, operator.source.schemaSet, args) &&
      this.checkHorizontalArray(
        operator.aggs,
        operator.source.schemaSet,
        args,
      ) &&
      operator.source.accept(this.vmap, args)
    );
  }
  visitLimit(operator: plan.Limit, args: ArcDescentArgs): boolean {
    return operator.source.accept(this.vmap, args);
  }
  protected visitSetOp(
    operator: plan.SetOperator,
    args: ArcDescentArgs,
  ): boolean {
    return (
      operator.left.accept(this.vmap, args) &&
      operator.right.accept(this.vmap, args)
    );
  }
  visitUnion(operator: plan.Union, args: ArcDescentArgs): boolean {
    return this.visitSetOp(operator, args);
  }
  visitIntersection(
    operator: plan.Intersection,
    args: ArcDescentArgs,
  ): boolean {
    return this.visitSetOp(operator, args);
  }
  visitDifference(operator: plan.Difference, args: ArcDescentArgs): boolean {
    return this.visitSetOp(operator, args);
  }
  visitDistinct(operator: plan.Distinct, args: ArcDescentArgs): boolean {
    if (Array.isArray(operator.attrs)) {
      if (
        !this.checkHorizontalArray(
          operator.attrs,
          operator.source.schemaSet,
          args,
        )
      )
        return false;
    }
    return operator.source.accept(this.vmap, args);
  }
  visitNullSource(operator: plan.NullSource, args: ArcDescentArgs): boolean {
    return true;
  }
  visitAggregate(operator: plan.AggregateCall, args: ArcDescentArgs): boolean {
    return (
      !args.renamesInv.has(operator.fieldName.parts) &&
      this.checkVerticalArray(operator.args, args) &&
      operator.postGroupOp.accept(this.vmap, args)
    );
  }
  visitItemFnSource(
    operator: plan.ItemFnSource,
    args: ArcDescentArgs,
  ): boolean {
    return this.checkVerticalArray(operator.args, args);
  }
  visitTupleFnSource(
    operator: plan.TupleFnSource,
    args: ArcDescentArgs,
  ): boolean {
    return this.checkVerticalArray(operator.args, args);
  }
  visitQuantifier(operator: plan.Quantifier, args: ArcDescentArgs): boolean {
    return operator.query.accept(this.vmap, args);
  }
  visitIndexScan(operator: plan.IndexScan, args: ArcDescentArgs): boolean {
    return this.checkHorizontal(operator.access, operator.schemaSet, args);
  }
  visitIndexedRecursion(
    operator: plan.IndexedRecursion,
    args: ArcDescentArgs,
  ): boolean {
    return (
      this.checkHorizontal(operator.mapping, operator.source.schemaSet, args) &&
      this.checkHorizontalArray(
        operator.distinctKeys,
        operator.source.schemaSet,
        args,
      ) &&
      operator.source.accept(this.vmap, args)
    );
  }
  visitBidirectionalRecursion(
    operator: plan.BidirectionalRecursion,
    args: ArcDescentArgs,
  ): boolean {
    return (
      this.checkHorizontal(
        operator.mappingFwd,
        operator.source.schemaSet,
        args,
      ) &&
      this.checkHorizontal(
        operator.mappingRev,
        operator.source.schemaSet,
        args,
      ) &&
      operator.source.accept(this.vmap, args) &&
      operator.target.accept(this.vmap, args)
    );
  }
}
