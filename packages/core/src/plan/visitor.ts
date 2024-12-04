import { ASTIdentifier } from '../ast.js';
import * as operators from './operators/index.js';

export interface LogicalPlanOperator {
  accept<T>(visitor: LogicalPlanVisitor<T>): T;
}

export type Aliased<T = ASTIdentifier> = [T, ASTIdentifier];

export interface LogicalPlanVisitor<T> {
  visitProjection(operator: operators.Projection): T;
  visitSelection(operator: operators.Selection): T;
  visitSource(operator: operators.Source): T;
  visitCalculation(operator: operators.Calculation): T;
  visitLimit(operator: operators.Limit): T;
  visitSort(operator: operators.Sort): T;
  visitDifference(operator: operators.Difference): T;
  visitUnion(operator: operators.Union): T;
  visitIntersection(operator: operators.Intersection): T;
  visitNest(operator: operators.Nest): T;
  visitUnnest(operator: operators.Unnest): T;
  visitCartesianProduct(operator: operators.CartesianProduct): T;
}
