import { ASTNode, ASTVisitor } from '../ast.js';
import { LanguageManager } from '../lang-manager.js';
import { LogicalPlanOperator, LogicalPlanVisitor } from '../plan/visitor.js';
import {
  CalculationBuilder,
  CalculationParams,
} from './calculation-builder.js';

type VisitorConstr<T> = {
  new (
    visitors: Record<string, LogicalPlanVisitor<T>>,
    langMgr: LanguageManager
  ): LogicalPlanVisitor<T>;
};

export interface LogicalPlanVisitors {
  /**
   * Combines fncalls, literals etc. into a single function with clearly specified inputs
   */
  calculationBuilder: VisitorConstr<CalculationParams>;
}

export interface LogicalPlanBuilder extends ASTVisitor<LogicalPlanOperator> {
  buildPlan(node: ASTNode): LogicalPlanOperator;
}

export const coreVisitors = {
  logicalPlan: {
    calculationBuilder: CalculationBuilder,
  } satisfies LogicalPlanVisitors,
};

export type { CalculationParams } from './calculation-builder.js';
