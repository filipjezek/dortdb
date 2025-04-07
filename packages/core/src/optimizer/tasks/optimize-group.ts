import { Task, TaskContext } from '../optimizer.js';
import { Group } from '../search-space.js';
import { OptimizeExpr } from './optimize-expr.js';
import { OptimizeInputs } from './optimize-inputs.js';

export class OptimizeGroup implements Task {
  constructor(
    private group: Group,
    private ctx: TaskContext,
  ) {}

  public *perform(): Iterable<Task> {
    if (this.group.lowerBound > this.ctx.upperBound || this.group.winner) {
      return null;
    }

    for (const mexpr of this.group.multiExprs) {
      yield new OptimizeExpr(mexpr, this.ctx);
    }
    for (const mexpr of this.group.multiExprs) {
      yield new OptimizeInputs(mexpr, this.ctx);
    }
  }
}
