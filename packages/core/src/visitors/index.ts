import { ASTNode, ASTVisitor } from '../ast.js';
import { DortDBAsFriend } from '../db.js';
import { IdSet, PlanOperator, PlanVisitor } from '../plan/visitor.js';
import { AttributeRenameChecker } from './attribute-rename-checker.js';
import { AttributeRenamer } from './attribute-renamer.js';
import {
  CalculationBuilder,
  CalculationParams,
} from './calculation-builder.js';
import { EqualityChecker } from './equality-checker.js';
import { Executor } from './executor.js';
import { TransitiveDependencies } from './transitive-deps.js';
import { VariableMapper } from './variable-mapper.js';

type VisitorConstr<T extends PlanVisitor<any>> = {
  new (visitors: Record<string, T>, db: DortDBAsFriend): T;
};

export interface PlanVisitors {
  /**
   * Combines fncalls, literals etc. into a single function with clearly specified inputs
   */
  calculationBuilder: VisitorConstr<PlanVisitor<CalculationParams>>;
  transitiveDependencies: VisitorConstr<TransitiveDependencies>;
  attributeRenamer: VisitorConstr<AttributeRenamer>;
  attributeRenameChecker: VisitorConstr<AttributeRenameChecker>;
  equalityChecker: VisitorConstr<EqualityChecker>;
  variableMapper: VisitorConstr<VariableMapper>;
  executor: VisitorConstr<Executor>;
}

/**
 * A visitor that builds a logical plan from an AST.
 */
export interface LogicalPlanBuilder extends ASTVisitor<PlanOperator> {
  /**
   * Builds a logical plan from an AST node.
   * @param node The root node of the AST.
   * @param context The context to use for the plan.
   * @returns The plan operator, as well as the inferred context (@see {@link toInfer}).
   */
  buildPlan(
    node: ASTNode,
    context: IdSet,
  ): { plan: PlanOperator; inferred: IdSet };
}
/**
 * Some languages have grammars which require additional pass to fully resolve the schema of each plan operator.
 * Because language switches are usually processed during the first pass, the nested languages may not receive full context 
 * (and they may need to be processed to infer the full context in the first place). They may instead receive this symbol as 
 * a context key, which means that the referenced item/tuple source schema should be inferred.
 * @example
 * `select (
      lang xquery
      for $y in $ys
      return $foo:a/b
    ) ls
   from foo`
   // xquery logical plan builder should receive the following context:
   {foo.toInfer}
   // and should return the following inferred context:
   {foo.a}
 */
export const toInfer = Symbol('toInfer');

export const coreVisitors = {
  logicalPlan: {
    calculationBuilder: CalculationBuilder,
    transitiveDependencies: TransitiveDependencies,
    attributeRenamer: AttributeRenamer,
    attributeRenameChecker: AttributeRenameChecker,
    equalityChecker: EqualityChecker,
    variableMapper: VariableMapper,
    executor: Executor,
  } satisfies PlanVisitors,
};

export * from './calculation-builder.js';
export * from './transitive-deps.js';
export * from './attribute-rename-checker.js';
export * from './attribute-renamer.js';
export * from './equality-checker.js';
export * from './variable-mapper.js';
export * from './executor.js';
