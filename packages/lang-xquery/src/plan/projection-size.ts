import { ASTIdentifier, LogicalPlanTupleOperator } from '@dortdb/core';
import { XQueryLogicalPlanVisitor } from './index.js';
import { schemaToTrie } from '@dortdb/core/utils';

export class ProjectionSize extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public sizeCol: ASTIdentifier,
    public source: LogicalPlanTupleOperator
  ) {
    super();
    this.lang = lang;
    this.schema = [...source.schema.filter((x) => !x.equals(sizeCol)), sizeCol];
    this.schemaSet = schemaToTrie(this.schema);
    source.parent = this;
  }

  accept<T>(visitors: Record<string, XQueryLogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjectionSize(this);
  }
  replaceChild(
    current: LogicalPlanTupleOperator,
    replacement: LogicalPlanTupleOperator
  ): void {
    this.source = replacement;
    this.clearSchema();
    this.addToSchema(replacement.schema.filter((x) => !x.equals(this.sizeCol)));
    this.addToSchema(this.sizeCol);
  }
}
