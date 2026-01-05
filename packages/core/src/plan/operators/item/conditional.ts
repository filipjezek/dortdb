import { ASTIdentifier } from '../../../ast.js';
import { Trie } from '../../../data-structures/trie.js';
import { cloneIfPossible, cloneWithArgs } from '../../../internal-fns/index.js';
import { ArgMeta } from '../../../visitors/calculation-builder.js';
import { IdSet, PlanOperator, PlanVisitor } from '../../visitor.js';
import { CalcIntermediate, Calculation } from './calculation.js';

export class Conditional implements PlanOperator {
  public [CalcIntermediate] = true;
  public dependencies: IdSet;

  constructor(
    public lang: Lowercase<string>,
    public condition: PlanOperator | ASTIdentifier,
    public whenThens: [
      PlanOperator | ASTIdentifier,
      PlanOperator | ASTIdentifier,
    ][],
    public defaultCase: PlanOperator | ASTIdentifier,
  ) {
    this.dependencies = new Trie();
    const items = whenThens.flat();
    if (condition) items.push(condition);
    if (defaultCase) items.push(defaultCase);
    for (const item of items) {
      if (item instanceof ASTIdentifier) {
        this.dependencies.add(item.parts);
      } else {
        item.parent = this;
      }
    }
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitConditional(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    if (this.condition === current) {
      this.condition = replacement;
    } else if (this.defaultCase === current) {
      this.defaultCase = replacement;
    } else {
      for (const wt of this.whenThens) {
        if (wt[0] === current) {
          wt[0] = replacement;
          return;
        }
        if (wt[1] === current) {
          wt[1] = replacement;
          return;
        }
      }
    }
  }
  getChildren(): PlanOperator[] {
    return [this.condition, ...this.whenThens.flat(), this.defaultCase].filter(
      (ch) => ch && !(ch instanceof ASTIdentifier),
    ) as PlanOperator[];
  }

  /**
   * Clone this FnCall
   * @param meta provided by cloned {@link Calculation}, should be modified in-place
   * to reflect new locations of arguments
   */
  clone(meta?: ArgMeta[]): Conditional {
    const res = new Conditional(
      this.lang,
      cloneWithArgs(this.condition, meta),
      this.whenThens.map((wt) => [
        cloneWithArgs(wt[0], meta),
        cloneWithArgs(wt[1], meta),
      ]),
      cloneWithArgs(this.defaultCase, meta),
    );

    for (const m of meta ?? []) {
      for (const loc of m.originalLocations) {
        if (loc.op === this) loc.op = res;
        else continue;
        if (loc.obj === this) loc.obj = res;
        else {
          const i = this.whenThens.indexOf(loc.obj as any);
          if (i !== -1) loc.obj = res.whenThens[i];
        }
      }
    }
    return res;
  }
}
