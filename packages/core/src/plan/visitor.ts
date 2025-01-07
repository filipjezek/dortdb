import { ASTIdentifier } from '../ast.js';
import * as operators from './operators/index.js';

export interface LogicalPlanOperator {
  lang: string;

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T;
}
export interface LogicalPlanTupleOperator extends LogicalPlanOperator {
  schema: ASTIdentifier[];
}

export type LogicalOpOrId = LogicalPlanOperator | ASTIdentifier;

export type Aliased<T = ASTIdentifier> = [T, ASTIdentifier];

export interface LogicalPlanVisitor<T> {
  visitProjection(operator: operators.Projection): T;
  visitSelection(operator: operators.Selection): T;
  visitTupleSource(operator: operators.TupleSource): T;
  visitItemSource(operator: operators.ItemSource): T;
  visitFnCall(operator: operators.FnCall): T;
  visitLiteral(operator: operators.Literal): T;
  visitCalculation(operator: operators.Calculation): T;
  visitConditional(operator: operators.Conditional): T;
  visitCartesianProduct(operator: operators.CartesianProduct): T;
  visitJoin(operator: operators.Join): T;
  visitProjectionConcat(operator: operators.ProjectionConcat): T;
  visitMapToItem(operator: operators.MapToItem): T;
  visitMapFromItem(operator: operators.MapFromItem): T;
  visitProjectionIndex(operator: operators.ProjectionIndex): T;
  visitOrderBy(operator: operators.OrderBy): T;
  visitGroupBy(operator: operators.GroupBy): T;
  visitLimit(operator: operators.Limit): T;
  visitUnion(operator: operators.Union): T;
  visitIntersection(operator: operators.Intersection): T;
  visitDifference(operator: operators.Difference): T;
  visitDistinct(operator: operators.Distinct): T;
  visitNullSource(operator: operators.NullSource): T;
  visitAggregate(operator: operators.AggregateCall): T;
  visitItemFnSource(operator: operators.ItemFnSource): T;
  visitTupleFnSource(operator: operators.TupleFnSource): T;
  visitQuantifier(operator: operators.Quantifier): T;
}
