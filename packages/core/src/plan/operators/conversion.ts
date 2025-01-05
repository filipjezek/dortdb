import { ASTIdentifier } from '../../ast.js';
import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../visitor.js';

export class MapToItem implements LogicalPlanOperator {
  constructor(
    public lang: string,
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

export class MapFromItem implements LogicalPlanTupleOperator {
  public schema: ASTIdentifier[];

  constructor(
    public lang: string,
    public key: ASTIdentifier,
    public source: LogicalPlanOperator
  ) {
    this.schema = [key];
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitMapFromItem(this);
  }
}
