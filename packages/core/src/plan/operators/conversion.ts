import { allAttrs, ASTIdentifier } from '../../ast.js';
import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../visitor.js';
import { schemaToTrie } from '../../utils/trie.js';
import { Trie } from '../../data-structures/trie.js';

export class MapToItem implements LogicalPlanOperator {
  public parent: LogicalPlanOperator;
  public dependencies = new Trie<string | symbol>();

  constructor(
    public lang: Lowercase<string>,
    public key: ASTIdentifier,
    public source: LogicalPlanTupleOperator,
  ) {
    if (!key) {
      this.key =
        source.schema?.length === 1
          ? source.schema[0]
          : ASTIdentifier.fromParts([allAttrs]);
    }
    source.parent = this;
  }

  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitMapToItem(this, arg);
  }
  replaceChild(
    current: LogicalPlanTupleOperator,
    replacement: LogicalPlanTupleOperator,
  ): void {
    this.source = replacement;
  }
  getChildren(): LogicalPlanOperator[] {
    return [this.source];
  }
}

export class MapFromItem extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public key: ASTIdentifier,
    public source: LogicalPlanOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = [key];
    this.schemaSet = schemaToTrie(this.schema);
    source.parent = this;
  }

  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitMapFromItem(this, arg);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    this.source = replacement;
  }
  getChildren(): LogicalPlanOperator[] {
    return [this.source];
  }
}
