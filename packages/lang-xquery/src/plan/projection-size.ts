import { ASTIdentifier, LogicalPlanTupleOperator, utils } from '@dortdb/core';
import { XQueryLogicalPlanVisitor } from './index.js';

export class ProjectionSize extends LogicalPlanTupleOperator {
  constructor(
    public lang: Lowercase<string>,
    public sizeCol: ASTIdentifier,
    public source: LogicalPlanTupleOperator
  ) {
    super();
    this.schema = [...source.schema.filter((x) => !x.equals(sizeCol)), sizeCol];
    this.schemaSet = utils.schemaToTrie(this.schema);
  }

  accept<T>(visitors: Record<string, XQueryLogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjectionSize(this);
  }
}
