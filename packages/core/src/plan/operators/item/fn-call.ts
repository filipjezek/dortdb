import { ASTIdentifier } from '../../../ast.js';
import { isId } from '../../../internal-fns/index.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { IdSet, PlanOperator, PlanVisitor } from '../../visitor.js';
import { CalcIntermediate } from './calculation.js';

export interface PlanOpAsArg {
  op: PlanOperator;
  /** can the subquery return more than one value?
   * if true, the subquery will be converted to an array of values
   */
  acceptSequence?: boolean;
}

export class FnCall implements PlanOperator {
  public [CalcIntermediate] = true;
  public dependencies: IdSet;

  constructor(
    public lang: Lowercase<string>,
    public args: (ASTIdentifier | PlanOpAsArg)[],
    public impl: (...args: any[]) => any,
    /**
     * Function is pure if it has no side effects and always returns the same output for the same input.
     * This means that `() => ({})` is not pure.
     */
    public pure = false,
  ) {
    this.dependencies = schemaToTrie(args.filter(isId));
    for (const arg of args) {
      if ('op' in arg) {
        arg.op.parent = this;
      }
    }
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitFnCall(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    for (const arg of this.args) {
      if ('op' in arg && arg.op === current) {
        arg.op = replacement;
        replacement.parent = this;
        return;
      }
    }
  }
  getChildren(): PlanOperator[] {
    const res: PlanOperator[] = [];
    for (const arg of this.args) {
      if ('op' in arg) {
        res.push(arg.op);
      }
    }
    return res;
  }
}
