import {
  Projection,
  Selection,
  TupleSource,
  ItemSource,
  FnCall,
  Literal,
  Calculation,
  Conditional,
  CartesianProduct,
  Join,
  ProjectionConcat,
  MapToItem,
  MapFromItem,
  ProjectionIndex,
  OrderBy,
  GroupBy,
  Limit,
  Union,
  Intersection,
  Difference,
  Distinct,
  NullSource,
  AggregateCall,
  ItemFnSource,
  TupleFnSource,
  Quantifier,
} from '@dortdb/core/plan';
import {
  ASTIdentifier,
  IdSet,
  LogicalOpOrId,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '@dortdb/core';
import { union } from '@dortdb/core/utils';

/**
 * Propagates the context of the schema through the plan. Building block for more complex visitors.
 */
export abstract class ContextPropagator
  implements LogicalPlanVisitor<void, IdSet>
{
  constructor(
    private vmap: Record<string, LogicalPlanVisitor<void, IdSet>>,
    protected lang: Lowercase<string>,
  ) {}

  private processAttr(attr: LogicalOpOrId, ctx: IdSet) {
    if (!(attr instanceof ASTIdentifier)) {
      this.descend(attr, ctx);
    }
  }
  private descend(operator: LogicalPlanOperator, ctx: IdSet) {
    if (operator.lang === this.lang) {
      operator.accept(this.vmap, ctx);
    }
  }

  visitProjection(operator: Projection, ctx: IdSet): void {
    this.descend(operator.source, ctx);
    ctx = union(ctx, operator.source.schema);
    for (const attr of operator.attrs) {
      this.processAttr(attr[0], ctx);
    }
  }
  visitSelection(operator: Selection, ctx: IdSet): void {
    this.descend(operator.source, ctx);
    ctx = union(ctx, operator.schema);
    this.processAttr(operator.condition, ctx);
  }
  visitTupleSource(operator: TupleSource, ctx: IdSet): void {
    return;
  }
  visitItemSource(operator: ItemSource, ctx: IdSet): void {
    return;
  }
  visitFnCall(operator: FnCall, ctx: IdSet): void {
    throw new Error('Method not implemented.');
  }
  visitLiteral(operator: Literal, ctx: IdSet): void {
    throw new Error('Method not implemented.');
  }
  visitCalculation(operator: Calculation, ctx: IdSet): void {
    for (const arg of operator.args) {
      this.processAttr(arg, ctx);
    }
  }
  visitConditional(operator: Conditional, ctx: IdSet): void {
    throw new Error('Method not implemented.');
  }
  visitCartesianProduct(operator: CartesianProduct, ctx: IdSet): void {
    this.descend(operator.left, ctx);
    this.descend(operator.right, ctx);
  }
  visitJoin(operator: Join, ctx: IdSet): void {
    this.visitCartesianProduct(operator, ctx);
    if (operator.on) {
      this.descend(operator.on, union(ctx, operator.schema));
    }
  }
  visitProjectionConcat(operator: ProjectionConcat, ctx: IdSet): void {
    this.descend(operator.source, ctx);
    this.descend(operator.mapping, union(ctx, operator.source.schema));
  }
  visitMapToItem(operator: MapToItem, ctx: IdSet): void {
    this.descend(operator.source, ctx);
  }
  visitMapFromItem(operator: MapFromItem, ctx: IdSet): void {
    this.descend(operator.source, ctx);
  }
  visitProjectionIndex(operator: ProjectionIndex, ctx: IdSet): void {
    this.descend(operator.source, ctx);
  }
  visitOrderBy(operator: OrderBy, ctx: IdSet): void {
    this.descend(operator.source, ctx);
    ctx = union(ctx, operator.schema);
    for (const arg of operator.orders) {
      this.processAttr(arg.key, ctx);
    }
  }
  visitGroupBy(operator: GroupBy, ctx: IdSet): void {
    this.descend(operator.source, ctx);
    for (const agg of operator.aggs) {
      this.descend(agg.postGroupOp, ctx);
    }
    ctx = union(ctx, operator.source.schemaSet);
    for (const arg of operator.keys) {
      this.processAttr(arg[0], ctx);
    }
  }
  visitLimit(operator: Limit, ctx: IdSet): void {
    this.descend(operator.source, ctx);
  }
  visitUnion(operator: Union, ctx: IdSet): void {
    this.descend(operator.left, ctx);
    this.descend(operator.right, ctx);
  }
  visitIntersection(operator: Intersection, ctx: IdSet): void {
    this.descend(operator.left, ctx);
    this.descend(operator.right, ctx);
  }
  visitDifference(operator: Difference, ctx: IdSet): void {
    this.descend(operator.left, ctx);
    this.descend(operator.right, ctx);
  }
  visitDistinct(operator: Distinct, ctx: IdSet): void {
    this.descend(operator.source, ctx);
    if (Array.isArray(operator.attrs)) {
      ctx = union(ctx, operator.schema);
      for (const attr of operator.attrs) {
        this.processAttr(attr, ctx);
      }
    }
  }
  visitNullSource(operator: NullSource, ctx: IdSet): void {
    return;
  }
  visitAggregate(operator: AggregateCall, ctx: IdSet): void {
    throw new Error('Method not implemented.');
  }
  visitItemFnSource(operator: ItemFnSource, ctx: IdSet): void {
    for (const arg of operator.args) {
      this.processAttr(arg, ctx);
    }
  }
  visitTupleFnSource(operator: TupleFnSource, ctx: IdSet): void {
    for (const arg of operator.args) {
      this.processAttr(arg, ctx);
    }
  }
  visitQuantifier(operator: Quantifier, ctx: IdSet): void {
    throw new Error('Method not implemented.');
  }
}
