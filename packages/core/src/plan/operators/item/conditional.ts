import { ASTIdentifier } from '../../../ast.js';
import { Trie } from '../../../data-structures/trie.js';
import { cloneIfPossible, cloneWithArgs } from '../../../internal-fns/index.js';
import { ArgMeta } from '../../../visitors/calculation-builder.js';
import { IdSet, PlanOperator, PlanVisitor } from '../../visitor.js';
import { CalcIntermediate, Calculation } from './calculation.js';

/**
 * A CASE / IF-THEN-ELSE expression: evaluates `condition` (if present), matches
 * against `whenThens` in order, and falls back to `defaultCase`.
 */
export class Conditional implements PlanOperator {
  /** Marks this as a {@link CalcIntermediate} sub-operator of a {@link Calculation}. */
  public [CalcIntermediate] = true;
  /** {@inheritDoc PlanOperator.dependencies} */
  public dependencies: IdSet;

  constructor(
    /** {@inheritDoc PlanOperator.lang} */
    public lang: Lowercase<string>,
    /** Searched-CASE operand; `null` for a simple CASE without a common operand. */
    public condition: PlanOperator | ASTIdentifier,
    /** Ordered list of `[WHEN, THEN]` pairs. */
    public whenThens: [
      PlanOperator | ASTIdentifier,
      PlanOperator | ASTIdentifier,
    ][],
    /** The ELSE expression; `null` means return `null` when no branch matches. */
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

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitConditional(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
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
  /** {@inheritDoc PlanOperator.getChildren} */
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
