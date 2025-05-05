import { ASTIdentifier } from '../../../ast.js';
import { Trie } from '../../../data-structures/trie.js';
import { IdSet, PlanOperator, PlanVisitor } from '../../visitor.js';
import { CalcIntermediate } from './calculation.js';

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
}
