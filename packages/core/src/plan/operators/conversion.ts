import { allAttrs, ASTIdentifier } from '../../ast.js';
import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../visitor.js';
import { schemaToTrie } from '../../utils/trie.js';
import { Trie } from '../../data-structures/trie.js';

export class MapToItem implements PlanOperator {
  public parent: PlanOperator;
  public dependencies = new Trie<string | symbol | number>();

  constructor(
    public lang: Lowercase<string>,
    public key: ASTIdentifier,
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

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitMapToItem(this, arg);
  }
  replaceChild(
    current: PlanTupleOperator,
    replacement: PlanTupleOperator,
  ): void {
    replacement.parent = this;
    this.source = replacement;
  }
  getChildren(): PlanOperator[] {
    return [this.source];
  }
  clone(): MapToItem {
    const clone = new MapToItem(this.lang, this.key, this.source.clone());
    return clone;
  }
}

export class MapFromItem extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public key: ASTIdentifier,
    public source: PlanOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = [key];
    this.schemaSet = schemaToTrie(this.schema);
    source.parent = this;
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitMapFromItem(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    this.source = replacement;
  }
  getChildren(): PlanOperator[] {
    return [this.source];
  }
  clone(): MapFromItem {
    const clone = new MapFromItem(this.lang, this.key, this.source.clone());
    return clone;
  }
}
