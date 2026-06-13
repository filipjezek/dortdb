import { Trie } from '../../../data-structures/trie.js';
import { ASTIdentifier } from '../../../ast.js';
import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { cloneIfPossible, isCalc, isId } from '../../../internal-fns/index.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { Index } from '../../../indices/index.js';

/** A leaf operator that reads rows from a named data source (table, collection, etc.). */
export class TupleSource extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** Identifier of the data source to read from. */
    public name: ASTIdentifier,
  ) {
    super();
    this.lang = lang;
    this.schema = [];
    this.schemaSet = new Trie<string | symbol>();
  }

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitTupleSource(this, arg);
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
  clone(): TupleSource {
    const res = new TupleSource(this.lang, this.name);
    res.schema = this.schema.slice();
    res.schemaSet = this.schemaSet.clone();
    return res;
  }
}

/** A leaf operator that produces tuple rows by invoking a generator function. */
export class TupleFnSource extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** Arguments passed to `impl`; identifiers are resolved at runtime. */
    public args: (ASTIdentifier | Calculation)[],
    /** Generator function that yields rows when called with the evaluated arguments. */
    public impl: (...args: any[]) => Iterable<unknown>,
    /** Optional name for this source, used for schema resolution. */
    public name?: ASTIdentifier,
  ) {
    super();
    this.lang = lang;
    this.schema = [];
    this.schemaSet = new Trie<string | symbol>();
    arrSetParent(this.args, this);
    this.dependencies = schemaToTrie(args.filter(isId));
  }

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitTupleFnSource(this, arg);
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
  clone(): TupleFnSource {
    const res = new TupleFnSource(
      this.lang,
      this.args.map(cloneIfPossible),
      this.impl,
      this.name,
    );
    res.schema = this.schema.slice();
    res.schemaSet = this.schemaSet.clone();
    return res;
  }
}

/**
 * A {@link TupleSource} variant that uses a secondary {@link Index} for efficient
 * key-based row lookup rather than a full sequential scan.
 */
export class IndexScan extends TupleSource {
  constructor(
    lang: Lowercase<string>,
    name: ASTIdentifier,
    /** The secondary index to probe. */
    public index: Index,
    /** Calculation that produces the lookup key(s) passed to the index. */
    public access: Calculation,
    /** When set, the lookup key is taken from this item-level attribute instead of `access`. */
    public fromItemKey?: ASTIdentifier,
  ) {
    super(lang, name);
    this.access.parent = this;
  }

  /** {@inheritDoc PlanOperator.accept} */
  override accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitIndexScan(this, arg);
  }

  /** {@inheritDoc PlanOperator.replaceChild} */
  override replaceChild(
    current: PlanOperator,
    replacement: PlanOperator,
  ): void {
    replacement.parent = this;
    this.access = replacement as Calculation;
  }

  /** {@inheritDoc PlanOperator.getChildren} */
  override getChildren(): PlanOperator[] {
    return [this.access];
  }
  /** {@inheritDoc PlanOperator.clone} */
  override clone(): IndexScan {
    const res = new IndexScan(
      this.lang,
      this.name as ASTIdentifier,
      this.index,
      this.access.clone(),
      this.fromItemKey,
    );
    res.schema = this.schema.slice();
    res.schemaSet = this.schemaSet.clone();
    return res;
  }
}
