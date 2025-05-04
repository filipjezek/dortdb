import { ASTIdentifier } from '../../../ast.js';
import { Trie } from '../../../data-structures/trie.js';
import { isId } from '../../../internal-fns/index.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { ArgMeta } from '../../../visitors/calculation-builder.js';
import { IdSet, OpOrId, PlanOperator, PlanVisitor } from '../../visitor.js';
import { AggregateCall } from './aggregate-call.js';

/**
 * This property identifies plan operators which are intermediate steps for {@link Calculation}
 */
export const CalcIntermediate = Symbol('CalcIntermediate');

/**
 * Built from literals, fncalls etc.
 */
export class Calculation implements PlanOperator {
  public parent: PlanOperator;
  public dependencies: IdSet;

  constructor(
    public lang: Lowercase<string>,
    public impl: (...args: any[]) => any,
    /** args which are plan operators will be instantiated as arrays during execution */
    public args: OpOrId[],
    public argMeta: ArgMeta[],
    public original?: PlanOperator,
    public aggregates: AggregateCall[] = [],
    public literal = false,
  ) {
    arrSetParent(args, this);
    arrSetParent(aggregates, this);
    this.dependencies = schemaToTrie(this.args.filter(isId));
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitCalculation(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    const arr = current instanceof AggregateCall ? this.aggregates : this.args;
    const idx = arr.indexOf(current);
    arr[idx] = replacement;
  }
  getChildren(): PlanOperator[] {
    const res: PlanOperator[] = [];
    for (const arg of this.args) {
      if (!(arg instanceof ASTIdentifier)) {
        res.push(arg);
      }
    }
    return res;
  }
}
