import { DortDBAsFriend } from '../db.js';
import { Limit } from '../plan/operators/index.js';
import { PlanOperator, PlanTupleOperator } from '../plan/visitor.js';
import { PatternRule, PatternRuleConstructor } from './rule.js';

export interface OptimizerConfig {
  /**
   * The optimization rules to apply. The order of rules matters.
   */
  rules: (PatternRule | PatternRuleConstructor)[];
}

/**
 * Optimizer for query plans.
 */
export class Optimizer {
  protected rules: PatternRule[];
  protected config: OptimizerConfig;

  constructor(
    config: OptimizerConfig,
    protected db: DortDBAsFriend,
  ) {
    this.reconfigure(config);
  }

  /**
   * Reconfigure the optimizer with a new set of rules.
   * @param config - The new configuration to apply.
   */
  public reconfigure(config: OptimizerConfig) {
    this.config = config;
    this.rules = config.rules.map((rule) => {
      if (typeof rule === 'function') {
        return new rule(this.db);
      }
      return rule;
    });
  }

  /**
   * Optimize the given query plan.
   * @param plan - The query plan to optimize.
   * @returns The optimized query plan.
   */
  public optimize(plan: PlanOperator): PlanOperator {
    this.breakReferences(plan);
    const planParent = new Limit('dummy', 0, 1, plan);
    for (const rule of this.rules) {
      this.visitOperator(planParent.source, rule);
    }
    const optimizedPlan = planParent.source;
    optimizedPlan.parent = null;
    return optimizedPlan;
  }

  /**
   * Visit an operator and apply the given rule. Recursively applies the rule to child operators.
   * @param operator - The operator to visit.
   * @param rule - The rule to apply.
   */
  protected visitOperator(operator: PlanOperator, rule: PatternRule) {
    if (
      rule.operator === null ||
      operator.constructor === rule.operator ||
      (Array.isArray(rule.operator) &&
        rule.operator.includes(operator.constructor as any))
    ) {
      const matchResult = rule.match(operator);
      if (matchResult !== null) {
        const parent = operator.parent;
        const transformedOperator = rule.transform(
          operator,
          matchResult.bindings,
        );
        if (transformedOperator !== operator) {
          parent.replaceChild(operator, transformedOperator);
          operator = transformedOperator;
        }
      }
    }
    for (const child of operator.getChildren()) {
      if (child.parent !== operator) {
        console.log('Parent mismatch (op, child)', operator, child);
        throw new Error('Parent mismatch');
      }
      this.visitOperator(child, rule);
    }
  }

  protected breakReferences(operator: PlanOperator) {
    if (
      operator instanceof PlanTupleOperator &&
      operator.parent instanceof PlanTupleOperator &&
      operator.schema === operator.parent.schema
    ) {
      operator.parent.schema = operator.schema.slice();
      operator.parent.schemaSet = operator.schemaSet.clone();
    }
    for (const child of operator.getChildren()) {
      this.breakReferences(child);
    }
  }
}
