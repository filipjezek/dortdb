import { ASTIdentifier } from '../../ast.js';
import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../visitor.js';
import { schemaToTrie } from '../../utils/trie.js';

export class MapToItem implements LogicalPlanOperator {
  constructor(
    public lang: Lowercase<string>,
    public key: ASTIdentifier,
    public source: LogicalPlanTupleOperator
  ) {
    if (!key) {
      if (source.schema?.length !== 1)
        throw new Error(
          `MapToItem: Cannot infer key from source schema - [${source.schema
            .map((s) => s.parts.join('.'))
            .join(', ')}]`
        );
      this.key = source.schema[0];
    }
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitMapToItem(this);
  }
}

export class MapFromItem extends LogicalPlanTupleOperator {
  constructor(
    public lang: Lowercase<string>,
    public key: ASTIdentifier,
    public source: LogicalPlanOperator
  ) {
    super();
    this.schema = [key];
    this.schemaSet = schemaToTrie(this.schema);
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitMapFromItem(this);
  }
}
