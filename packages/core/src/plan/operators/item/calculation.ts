import { ASTIdentifier } from '../../../ast.js';
import { Trie } from '../../../data-structures/trie.js';
import { isId } from '../../../internal-fns/index.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { ArgMeta } from '../../../visitors/calculation-builder.js';
import {
  IdSet,
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
  public dependencies: IdSet;

  constructor(
    public lang: Lowercase<string>,
    public impl: (...args: any[]) => any,
    /** args which are logical operators will be instantiated as arrays during execution */
    public args: LogicalOpOrId[],
    public argMeta: ArgMeta[],
    public aggregates: AggregateCall[] = [],
    public literal = false,
  ) {
    arrSetParent(args, this);
    arrSetParent(aggregates, this);
    this.dependencies = schemaToTrie(this.args.filter(isId));
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
    replacement.parent = this;
    const arr = current instanceof AggregateCall ? this.aggregates : this.args;
    const idx = arr.indexOf(current);
    arr[idx] = replacement;
  }
  getChildren(): LogicalPlanOperator[] {
    const res: LogicalPlanOperator[] = [];
    for (const arg of this.args) {
      if (!(arg instanceof ASTIdentifier)) {
        res.push(arg);
      }
    }
    return res;
  }
}
