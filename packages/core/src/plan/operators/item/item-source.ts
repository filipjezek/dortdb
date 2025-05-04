import { ASTIdentifier } from '../../../ast.js';
import { Trie } from '../../../data-structures/trie.js';
import { isCalc, isId } from '../../../internal-fns/index.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { Aliased, IdSet, PlanOperator, PlanVisitor } from '../../visitor.js';
import { Calculation } from './calculation.js';

export class ItemSource implements PlanOperator {
  public parent: PlanOperator;
  public dependencies = new Trie<string | symbol>();

  constructor(
    public lang: Lowercase<string>,
    public name: ASTIdentifier | Aliased<ASTIdentifier>,
  ) {}

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitItemSource(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    throw new Error('Method not implemented.');
  }
  getChildren(): PlanOperator[] {
    return [];
  }
}

export class ItemFnSource implements PlanOperator {
  public parent: PlanOperator;
  public dependencies: IdSet;

  constructor(
    public lang: Lowercase<string>,
    public args: (ASTIdentifier | Calculation)[],
    public impl: (...args: any[]) => Iterable<unknown>,
    public name?: ASTIdentifier | Aliased<ASTIdentifier>,
  ) {
    arrSetParent(this.args, this);
    this.dependencies = schemaToTrie(this.args.filter(isId));
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitItemFnSource(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    const i = this.args.indexOf(current as Calculation);
    this.args[i] = replacement as Calculation;
  }
  getChildren(): PlanOperator[] {
    return this.args.filter(isCalc);
  }
}
