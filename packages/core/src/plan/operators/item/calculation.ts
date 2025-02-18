import { arrSetParent } from '../../../utils/arr-set-parent.js';
import {
  LogicalOpOrId,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { AggregateCall } from './aggregate-call.js';

/**
 * This property identifies plan operators which are intermediate steps for {@link Calculation}
 */
export const CalcIntermediate = Symbol('CalcIntermediate');

/**
 * This is built from literals, fncalls etc. The purpose is to
 * extract required inputs for selection, projection etc.
 */
export class Calculation implements LogicalPlanOperator {
  public parent: LogicalPlanOperator;

  constructor(
    public lang: Lowercase<string>,
    public impl: (...args: any[]) => any,
    /** args which are logical operators will be instantiated as arrays during execution */
    public args: LogicalOpOrId[],
    public aggregates: AggregateCall[] = [],
    public literal = false,
  ) {
    arrSetParent(args, this);
    arrSetParent(aggregates, this);
  }

  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitCalculation(this, arg);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    const arr = current instanceof AggregateCall ? this.aggregates : this.args;
    const idx = arr.indexOf(current);
    arr[idx] = replacement;
  }
}
