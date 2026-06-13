import { ASTIdentifier } from '../../../ast.js';
import { Trie } from '../../../data-structures/trie.js';
import { cloneIfPossible, isCalc, isId } from '../../../internal-fns/index.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { Aliased, IdSet, PlanOperator, PlanVisitor } from '../../visitor.js';
import { Calculation } from './calculation.js';

/** A leaf operator that produces items from a named data source. */
export class ItemSource implements PlanOperator {
  /** {@inheritDoc PlanOperator.parent} */
  public parent: PlanOperator;
  /** {@inheritDoc PlanOperator.dependencies} */
  public dependencies = new Trie<string | symbol>();

  /**
   * @param name This should be aliased only while building the plan. It should be replaced with Projection before the actual execution.
   */
  constructor(
    /** {@inheritDoc PlanOperator.lang} */
    public lang: Lowercase<string>,
    /** Data source name; may be aliased during plan construction but must be resolved before execution. */
    public name: ASTIdentifier | Aliased<ASTIdentifier>,
  ) {}

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitItemSource(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    throw new Error('Method not implemented.');
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return [];
  }
  /** {@inheritDoc PlanOperator.clone} */
  clone(): ItemSource {
    return new ItemSource(this.lang, this.name);
  }
}

/** A leaf operator that produces items by invoking a generator function. */
export class ItemFnSource implements PlanOperator {
  /** {@inheritDoc PlanOperator.parent} */
  public parent: PlanOperator;
  /** {@inheritDoc PlanOperator.dependencies} */
  public dependencies: IdSet;

  /**
   * @param name This should be aliased only while building the plan. It should be replaced with Projection before the actual execution.
   */
  constructor(
    /** {@inheritDoc PlanOperator.lang} */
    public lang: Lowercase<string>,
    /** Arguments passed to `impl`; identifiers are resolved at runtime. */
    public args: (ASTIdentifier | Calculation)[],
    /** Generator function that yields items when called with the evaluated arguments. */
    public impl: (...args: any[]) => Iterable<unknown>,
    /** Optional name alias; see {@link ItemSource.name}. */
    public name?: ASTIdentifier | Aliased<ASTIdentifier>,
  ) {
    arrSetParent(this.args, this);
    this.dependencies = schemaToTrie(this.args.filter(isId));
  }

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitItemFnSource(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    const i = this.args.indexOf(current as Calculation);
    this.args[i] = replacement as Calculation;
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return this.args.filter(isCalc);
  }
  /** {@inheritDoc PlanOperator.clone} */
  clone(): ItemFnSource {
    return new ItemFnSource(
      this.lang,
      this.args.map(cloneIfPossible),
      this.impl,
      this.name,
    );
  }
}
