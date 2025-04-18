import { DortDBAsFriend } from '../db.js';
import { Limit } from '../plan/operators/index.js';
import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
} from '../plan/visitor.js';
import { union } from '../utils/trie.js';
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

  public optimize(plan: LogicalPlanOperator): LogicalPlanOperator {
    this.breakReferences(plan);
    const planParent = new Limit('dummy', 0, 1, plan);
    for (const rule of this.rules) {
      this.visitOperator(planParent.source, rule);
    }
    const optimizedPlan = planParent.source;
    optimizedPlan.parent = null;
    return optimizedPlan;
  }

  private visitOperator(operator: LogicalPlanOperator, rule: PatternRule) {
    if (operator.constructor === rule.operator) {
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
      this.visitOperator(child, rule);
    }
  }

  private breakReferences(operator: LogicalPlanOperator) {
    if (
      operator instanceof LogicalPlanTupleOperator &&
      operator.parent instanceof LogicalPlanTupleOperator &&
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
