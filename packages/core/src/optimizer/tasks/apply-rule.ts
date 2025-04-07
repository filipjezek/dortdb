import { LogicalPlanOperator } from '../../plan/visitor.js';
import { Task, TaskContext } from '../optimizer.js';
import { MultiExpression } from '../search-space.js';
import { OptimizeExpr } from './optimize-expr.js';
import { OptimizeInputs } from './optimize-inputs.js';

export class ApplyRule implements Task {
  constructor(
    private mexpr: MultiExpression,
    private ruleIndex: number,
    private ctx: TaskContext,
    private exploring = false,
  ) {}

  public *perform(): Iterable<Task> {
    if (this.mexpr.rulesApplied[this.ruleIndex]) {
      return null;
    }
    this.mexpr.rulesApplied[this.ruleIndex] = true;
    const rule = this.ctx.rules[this.ruleIndex];

    if (!rule.match(this.mexpr.operator)) {
      return null;
    }
    const result = rule.transform(this.mexpr.operator);
    if (!result) return null;
    if (Symbol.iterator in result) {
      for (const res of result) {
        yield* this.processRuleResult(res);
      }
    } else {
      yield* this.processRuleResult(result);
    }
  }

  private *processRuleResult(expr: LogicalPlanOperator): Iterable<Task> {
    const mexpr = this.ctx.sspace.addExpr(expr);
    yield new OptimizeExpr(mexpr, this.ctx, this.exploring);
    yield new OptimizeInputs(mexpr, this.ctx);
  }
}
