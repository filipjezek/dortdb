import { LogicalPlanOperator } from '../plan/visitor.js';
import { Rule } from './rule.js';
import { Group, SearchSpace } from './search-space.js';
import { OptimizeGroup } from './tasks/optimize-group.js';

export class Optimizer {
  /** epsilon for epsilon-pruning */
  static readonly EPSILON = 1e-4;
  private tasks: Task[] = [];
  private sspace: SearchSpace;

  public optimize(query: LogicalPlanOperator) {
    this.sspace = new SearchSpace();
    const g0 = this.sspace.addExpr(query).containerGroup;

    this.tasks.push(
      new OptimizeGroup(g0, {
        upperBound: Infinity,
        rules: [],
        sspace: this.sspace,
      }),
    );
    while (this.tasks.length > 0) {
      const task = this.tasks.pop();
      const results = task.perform();
      if (results) {
        if (Symbol.iterator in results) {
          for (const result of results) {
            this.tasks.push(result);
          }
        } else {
          this.tasks.push(results);
        }
      }
    }

    return g0.winner.mexpr.operator;
  }
}

export interface TaskContext {
  upperBound: number;
  rules: Rule[];
  sspace: SearchSpace;
}
export interface Task {
  perform: () => Task | Iterable<Task>;
}
