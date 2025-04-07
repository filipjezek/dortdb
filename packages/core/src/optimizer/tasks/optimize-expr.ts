import { Task, TaskContext } from '../optimizer.js';
import { Rule } from '../rule.js';
import { MultiExpression } from '../search-space.js';
import { ApplyRule } from './apply-rule.js';
import { ExploreGroup } from './explore-group.js';

export class OptimizeExpr implements Task {
  constructor(
    private mexpr: MultiExpression,
    private ctx: TaskContext,
    private exploring = false,
  ) {}

  public *perform(): Iterable<Task> {
    const rSize = this.ctx.rules.length;
    const potentials: number[] = new Array(rSize);
    const rulesToApply: number[] = [];

    for (let i = 0; i < rSize; ++i) {
      if (this.mexpr.rulesApplied[i]) {
        continue;
      }
      const rule = this.ctx.rules[i];
      if (rule.operator !== this.mexpr.operator.constructor) continue;
      const p = potential(rule, this.ctx);
      if (p > 0) {
        potentials[i] = p;
        rulesToApply.push(i);
      }
    }

    // tasks are scheduled using a stack, so we need to order by ascending potential
    // to ensure that the most promising rules are applied first
    rulesToApply.sort((a, b) => potentials[a] - potentials[b]);
    for (const ruleI of rulesToApply) {
      yield new ApplyRule(this.mexpr, ruleI, this.ctx, this.exploring);
      for (const group of this.mexpr.inputs) {
        if (!group.explored) {
          yield new ExploreGroup(group, this.ctx);
        }
      }
    }
  }
}

function potential(rule: Rule, ctx: TaskContext) {
  return 1;
}
