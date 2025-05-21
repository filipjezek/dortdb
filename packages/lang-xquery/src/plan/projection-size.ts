import { ASTIdentifier, PlanOperator, PlanTupleOperator } from '@dortdb/core';
import { XQueryPlanVisitor } from './index.js';
import { schemaToTrie } from '@dortdb/core/utils';

export class ProjectionSize extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public sizeCol: ASTIdentifier,
    public source: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = [...source.schema.filter((x) => !x.equals(sizeCol)), sizeCol];
    this.schemaSet = schemaToTrie(this.schema);
    source.parent = this;
  }

  accept<Ret, Arg>(
    visitors: Record<string, XQueryPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitProjectionSize(this, arg);
  }
  replaceChild(
    current: PlanTupleOperator,
    replacement: PlanTupleOperator,
  ): void {
    replacement.parent = this;
    this.source = replacement;
    this.clearSchema();
    this.addToSchema(replacement.schema.filter((x) => !x.equals(this.sizeCol)));
    this.addToSchema(this.sizeCol);
  }
  override getChildren(): PlanOperator[] {
    return [this.source];
  }
  clone(): ProjectionSize {
    return new ProjectionSize(this.lang, this.sizeCol, this.source.clone());
  }
}
