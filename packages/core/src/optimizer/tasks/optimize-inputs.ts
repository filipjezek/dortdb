import { Optimizer, Task, TaskContext } from '../optimizer.js';
import { MultiExpression } from '../search-space.js';
import { OptimizeGroup } from './optimize-group.js';

export class OptimizeInputs implements Task {
  private inputCost: number[];
  private localCost = 0;
  private totalCost = 0;
  private optimizedInputs = 0;

  constructor(
    private mexpr: MultiExpression,
    private ctx: TaskContext,
  ) {}

  public perform(): Iterable<Task> {
    if (!this.inputCost) {
      this.initInputCost();
    }

    if (this.totalCost > this.ctx.upperBound) {
      return null;
    }
    if (this.optimizedInputs > 1) {
      const prevInput = this.mexpr.inputs[this.optimizedInputs - 1];
      if (!prevInput.winner?.mexpr) {
        // we were unable to optimize the previous input, this task is impossible
        prevInput.winner ??= { mexpr: null, cost: 0 };
        return null;
      }
    }

    while (this.optimizedInputs < this.mexpr.inputs.length) {
      const input = this.mexpr.inputs[this.optimizedInputs];
      if (input.winner?.mexpr) {
        this.totalCost +=
          input.winner.cost - this.inputCost[this.optimizedInputs];
        this.inputCost[this.optimizedInputs] = input.winner.cost;
        if (this.totalCost > this.ctx.upperBound) {
          return null;
        }
        this.optimizedInputs++;
        continue;
      }

      return [this, new OptimizeGroup(input, this.ctx)];
    }

    // all inputs have been optimized
    if (this.totalCost >= this.ctx.upperBound) {
      return null;
    }
    const group = this.mexpr.containerGroup;
    if (this.totalCost <= Optimizer.EPSILON) {
      group.winner = {
        mexpr: this.mexpr,
        cost: this.totalCost,
      };
    } else if (!group.winner || this.totalCost < group.winner.cost) {
      group.winner = {
        mexpr: this.mexpr,
        cost: this.totalCost,
      };
    }
    return null;
  }

  private initInputCost() {
    this.inputCost = new Array(this.mexpr.inputs.length);
    for (let i = 0; i < this.mexpr.inputs.length; ++i) {
      const input = this.mexpr.inputs[i];
      if (!input.winner) {
        this.inputCost[i] = input.lowerBound;
      } else if (input.winner.mexpr) {
        this.inputCost[i] = input.winner.cost;
      } else {
        // null plan
        this.inputCost[i] = Math.max(input.lowerBound, input.winner.cost);
      }
      this.localCost += this.inputCost[i];
    }
  }
}
