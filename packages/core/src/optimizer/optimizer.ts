import { Limit } from '../plan/operators/index.js';
import { LogicalPlanOperator } from '../plan/visitor.js';
import { PatternRule } from './rule.js';

export interface OptimizerConfig {
  rules: PatternRule[];
}

export class Optimizer {
  constructor(private config: OptimizerConfig) {}

  public reconfigure(config: OptimizerConfig) {
    this.config = config;
  }

  public optimize(plan: LogicalPlanOperator): LogicalPlanOperator {
    const planParent = new Limit('dummy', 0, 1, plan);
    for (const rule of this.config.rules) {
      this.visitOperator(planParent.source, rule);
    }
    const optimizedPlan = planParent.source;
    optimizedPlan.parent = null;
    return optimizedPlan;
  }

  private visitOperator(operator: LogicalPlanOperator, rule: PatternRule) {
    if (operator.constructor === rule.operator && rule.match(operator)) {
      const transformedOperator = rule.transform(operator);
      operator.parent.replaceChild(operator, transformedOperator);
      operator = transformedOperator;
    }
    for (const child of operator.getChildren()) {
      this.visitOperator(child, rule);
    }
  }
}
