import { LogicalPlanVisitor } from '../plan/visitor.js';
import * as plan from '../plan/operators/index.js';
import { DortDBAsFriend } from '../db.js';

export class CostEstimator implements LogicalPlanVisitor<number, number[]> {
  constructor(
    private vmap: Record<string, LogicalPlanVisitor<number, number[]>>,
    private db: DortDBAsFriend,
  ) {}

  visitRecursion(operator: plan.Recursion, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
  visitProjection(operator: plan.Projection, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
  visitSelection(operator: plan.Selection, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
  visitTupleSource(
    operator: plan.TupleSource,
    cardinalities: number[],
  ): number {
    throw new Error('Method not implemented.');
  }
  visitItemSource(operator: plan.ItemSource, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
  visitFnCall(operator: plan.FnCall, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
  visitLiteral(operator: plan.Literal, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
  visitCalculation(
    operator: plan.Calculation,
    cardinalities: number[],
  ): number {
    throw new Error('Method not implemented.');
  }
  visitConditional(
    operator: plan.Conditional,
    cardinalities: number[],
  ): number {
    throw new Error('Method not implemented.');
  }
  visitCartesianProduct(
    operator: plan.CartesianProduct,
    cardinalities: number[],
  ): number {
    throw new Error('Method not implemented.');
  }
  visitJoin(operator: plan.Join, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
  visitProjectionConcat(
    operator: plan.ProjectionConcat,
    cardinalities: number[],
  ): number {
    throw new Error('Method not implemented.');
  }
  visitMapToItem(operator: plan.MapToItem, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
  visitMapFromItem(
    operator: plan.MapFromItem,
    cardinalities: number[],
  ): number {
    throw new Error('Method not implemented.');
  }
  visitProjectionIndex(
    operator: plan.ProjectionIndex,
    cardinalities: number[],
  ): number {
    throw new Error('Method not implemented.');
  }
  visitOrderBy(operator: plan.OrderBy, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
  visitGroupBy(operator: plan.GroupBy, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
  visitLimit(operator: plan.Limit, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
  visitUnion(operator: plan.Union, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
  visitIntersection(
    operator: plan.Intersection,
    cardinalities: number[],
  ): number {
    throw new Error('Method not implemented.');
  }
  visitDifference(operator: plan.Difference, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
  visitDistinct(operator: plan.Distinct, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
  visitNullSource(operator: plan.NullSource, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
  visitAggregate(
    operator: plan.AggregateCall,
    cardinalities: number[],
  ): number {
    throw new Error('Method not implemented.');
  }
  visitItemFnSource(
    operator: plan.ItemFnSource,
    cardinalities: number[],
  ): number {
    throw new Error('Method not implemented.');
  }
  visitTupleFnSource(
    operator: plan.TupleFnSource,
    cardinalities: number[],
  ): number {
    throw new Error('Method not implemented.');
  }
  visitQuantifier(operator: plan.Quantifier, cardinalities: number[]): number {
    throw new Error('Method not implemented.');
  }
}
