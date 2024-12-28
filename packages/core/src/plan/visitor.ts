import { ASTIdentifier } from '../ast.js';
import * as operators from './operators/index.js';

export interface LogicalPlanOperator {
  lang: string;

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T;
}

export const groupbyAttr = Symbol('group by attribute');
export type Aliased<T = ASTIdentifier> = [
  T,
  ASTIdentifier | typeof groupbyAttr
];

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
  visitLeftOuterJoin(operator: operators.LeftOuterJoin): T;
  visitFullOuterJoin(operator: operators.FullOuterJoin): T;
  visitProjectionConcat(operator: operators.ProjectionConcat): T;
  visitMapToItem(operator: operators.MapToItem): T;
  visitMapFromItem(operator: operators.MapFromItem): T;
  visitProjectionIndex(operator: operators.ProjectionIndex): T;
  visitOrderBy(operator: operators.OrderBy): T;
  visitGroupBy(operator: operators.GroupBy): T;
}
