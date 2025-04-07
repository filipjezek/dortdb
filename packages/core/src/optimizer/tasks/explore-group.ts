import { Task, TaskContext } from '../optimizer.js';
import { Group } from '../search-space.js';
import { OptimizeExpr } from './optimize-expr.js';

export class ExploreGroup implements Task {
  constructor(
    private group: Group,
    private ctx: TaskContext,
  ) {}

  public *perform(): Iterable<Task> {
    if (this.group.explored) {
      return null;
    }
    this.group.explored = true;

    for (const mexpr of this.group.multiExprs) {
      yield new OptimizeExpr(mexpr, this.ctx, true);
    }
  }
}
