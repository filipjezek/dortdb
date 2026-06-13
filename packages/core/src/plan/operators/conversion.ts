import { allAttrs, ASTIdentifier } from '../../ast.js';
import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../visitor.js';
import { schemaToTrie } from '../../utils/trie.js';
import { Trie } from '../../data-structures/trie.js';

/** Converts a named-attribute tuple stream to an item stream by extracting a single column. */
export class MapToItem implements PlanOperator {
  /** {@inheritDoc PlanOperator.parent} */
  public parent: PlanOperator;
  /** {@inheritDoc PlanOperator.dependencies} */
  public dependencies = new Trie<string | symbol | number>();

  constructor(
    /** {@inheritDoc PlanOperator.lang} */
    public lang: Lowercase<string>,
    /**
     * Column to extract as the item value; defaults to the sole column in `source.schema`,
     * or `allAttrs` when the schema has more than one column.
     */
    public key: ASTIdentifier,
    /** Tuple operator providing the input rows. */
    public source: PlanTupleOperator,
  ) {
    if (!key) {
      this.key =
        source.schema?.length === 1
          ? source.schema[0]
          : ASTIdentifier.fromParts([allAttrs]);
    }
    this.dependencies.add(this.key.parts);
    source.parent = this;
  }

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitMapToItem(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(
    current: PlanTupleOperator,
    replacement: PlanTupleOperator,
  ): void {
    replacement.parent = this;
    this.source = replacement;
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return [this.source];
  }
  /** {@inheritDoc PlanOperator.clone} */
  clone(): MapToItem {
    const clone = new MapToItem(this.lang, this.key, this.source.clone());
    return clone;
  }
}

/** Wraps an item-level operator as a single-column tuple stream. */
export class MapFromItem extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** Name of the output column that holds each item value. */
    public key: ASTIdentifier,
    /** Item operator providing the values. */
    public source: PlanOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = [key];
    this.schemaSet = schemaToTrie(this.schema);
    source.parent = this;
  }

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitMapFromItem(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    this.source = replacement;
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return [this.source];
  }
  /** {@inheritDoc PlanOperator.clone} */
  clone(): MapFromItem {
    const clone = new MapFromItem(this.lang, this.key, this.source.clone());
    return clone;
  }
}
