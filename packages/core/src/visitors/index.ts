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

/** Constructor shape for a plan visitor: takes the per-language visitor registry and the database handle. */
export type VisitorConstr<T extends PlanVisitor<any>> = {
  new (visitors: Record<string, T>, db: DortDBAsFriend): T;
};

/**
 * The set of plan-visitor constructors that every language plugin must provide.
 * The engine instantiates one visitor per language and combines them into a multi-language
 * dispatch map so that mixed-language plan trees are traversed correctly.
 */
export interface PlanVisitors {
  /**
   * Combines fncalls, literals etc. into a single function with clearly specified inputs
   */
  calculationBuilder: VisitorConstr<PlanVisitor<CalculationParams>>;
  /** Computes the set of identifiers that each plan node depends on from outer scopes. */
  transitiveDependencies: VisitorConstr<TransitiveDependencies>;
  /** Applies an attribute rename map to a plan subtree in place. */
  attributeRenamer: VisitorConstr<AttributeRenamer>;
  /** Checks whether applying a rename map to a plan subtree would be safe. */
  attributeRenameChecker: VisitorConstr<AttributeRenameChecker>;
  /** Checks structural equality between two plan operator trees. */
  equalityChecker: VisitorConstr<EqualityChecker>;
  /** Translates named identifiers in the plan to numeric indices for the executor. */
  variableMapper: VisitorConstr<VariableMapper>;
  /** Executes a logical plan and produces result items. */
  executor: VisitorConstr<Executor>;
}

/** The result of {@link LogicalPlanBuilder.buildPlan}. */
export interface BuildPlanResult {
  /** The root operator of the constructed logical plan. */
  plan: PlanOperator;
  /** The schema attributes inferred during planning (see {@link toInfer}). */
  inferred: IdSet;
}

/**
 * A visitor that builds a logical plan from an AST.
 */
export interface LogicalPlanBuilder extends ASTVisitor<PlanOperator> {
  /**
   * Builds a logical plan from an AST node.
   * @param node The root node of the AST.
   * @param context The context to use for the plan.
   * @param languageContext The per-language additional context. For example, SQL may use this
   * to pass in definitions of CTEs created in an outer language switch.
   * @returns The plan operator, as well as the inferred context (@see {@link toInfer}).
   */
  buildPlan(
    node: ASTNode,
    context: IdSet,
    languageContext: Record<string, unknown>,
  ): BuildPlanResult;
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

/**
 * Default {@link PlanVisitors} constructors bundled with `@dortdb/core`.
 * Language plugins extend this by contributing their own visitor implementations
 * via the language manager.
 */
export const coreVisitors = {
  /** Visitor constructors for the logical-plan traversal passes. */
  logicalPlan: {
    /** @see {@link CalculationBuilder} */
    calculationBuilder: CalculationBuilder,
    /** @see {@link TransitiveDependencies} */
    transitiveDependencies: TransitiveDependencies,
    /** @see {@link AttributeRenamer} */
    attributeRenamer: AttributeRenamer,
    /** @see {@link AttributeRenameChecker} */
    attributeRenameChecker: AttributeRenameChecker,
    /** @see {@link EqualityChecker} */
    equalityChecker: EqualityChecker,
    /** @see {@link VariableMapper} */
    variableMapper: VariableMapper,
    /** Must be set by a language plugin before query execution. */
    executor: null as VisitorConstr<Executor>,
  } satisfies PlanVisitors,
};

export * from './calculation-builder.js';
export * from './transitive-deps.js';
export * from './attribute-rename-checker.js';
export * from './attribute-renamer.js';
export * from './equality-checker.js';
export * from './variable-mapper.js';
export * from './executor.js';
