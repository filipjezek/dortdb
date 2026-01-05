import { ASTIdentifier } from '../../../ast.js';
import { isId } from '../../../internal-fns/index.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { ArgMeta } from '../../../visitors/index.js';
import { IdSet, PlanOperator, PlanVisitor } from '../../visitor.js';
import { AggregateCall } from './aggregate-call.js';
import { CalcIntermediate, Calculation } from './calculation.js';

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

  /**
   * Clone this FnCall
   * @param meta provided by cloned {@link Calculation}, should be modified in-place
   * to reflect new locations of arguments
   */
  clone(meta?: ArgMeta[]): FnCall {
    const res = new FnCall(
      this.lang,
      this.args.map((arg) => {
        if ('op' in arg) {
          return {
            ...arg,
            op:
              CalcIntermediate in arg.op || arg.op instanceof AggregateCall
                ? arg.op.clone(meta)
                : arg.op.clone(),
          };
        }
        return arg;
      }),
      this.impl,
      this.pure,
    );
    for (const m of meta ?? []) {
      for (const loc of m.originalLocations) {
        if (loc.op === this) loc.op = res;
        else continue;
        if (loc.obj === this.args) loc.obj = res.args;
        else {
          const i = this.args.indexOf(loc.obj as any);
          if (i !== -1) loc.obj = res.args[i];
        }
      }
    }
    return res;
  }
}
