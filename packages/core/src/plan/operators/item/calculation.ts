import { arrSetParent } from '../../../utils/arr-set-parent.js';
import {
  LogicalOpOrId,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { AggregateCall } from './aggregate-call.js';

/**
 * This is built from literals, fncalls etc. The purpose is to
 * extract required inputs for selection, projection etc.
 */
export class Calculation implements LogicalPlanOperator {
  public parent: LogicalPlanOperator;

  constructor(
    public lang: Lowercase<string>,
    public impl: (...args: any[]) => any,
    public args: LogicalOpOrId[],
    public aggregates: AggregateCall[] = [],
    public literal = false
  ) {
    arrSetParent(args, this);
    arrSetParent(aggregates, this);
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitCalculation(this);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator
  ): void {
    const arr = current instanceof AggregateCall ? this.aggregates : this.args;
    const idx = arr.indexOf(current);
    arr[idx] = replacement;
  }
}
