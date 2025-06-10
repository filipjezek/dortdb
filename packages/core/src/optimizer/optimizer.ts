import { DortDBAsFriend } from '../db.js';
import { Limit } from '../plan/operators/index.js';
import { PlanOperator, PlanTupleOperator } from '../plan/visitor.js';
import { PatternRule, PatternRuleConstructor } from './rule.js';

export interface OptimizerConfig {
  rules: (PatternRule | PatternRuleConstructor)[];
}

export class Optimizer {
  private rules: PatternRule[];
  private config: OptimizerConfig;

  constructor(
    config: OptimizerConfig,
    private db: DortDBAsFriend,
  ) {
    this.reconfigure(config);
  }

  public reconfigure(config: OptimizerConfig) {
    this.config = config;
    this.rules = config.rules.map((rule) => {
      if (typeof rule === 'function') {
        return new rule(this.db);
      }
      return rule;
    });
  }

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

  private visitOperator(operator: PlanOperator, rule: PatternRule) {
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

  private breakReferences(operator: PlanOperator) {
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
