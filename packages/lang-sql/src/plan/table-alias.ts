import { ASTIdentifier, PlanOperator, PlanTupleOperator } from '@dortdb/core';
import { LangSwitch, SQLPlanVisitor } from './index.js';
import { overrideSource, schemaToTrie } from '@dortdb/core/utils';
import { TupleFnSource, TupleSource } from '@dortdb/core/plan';

export class TableAlias extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public alias: ASTIdentifier,
    public source: TupleFnSource | TupleSource | LangSwitch,
  ) {
    super();
    this.lang = lang;
    this.schema = source.schema.map((attr) => overrideSource(alias, attr));
    this.schemaSet = schemaToTrie(this.schema);
    source.parent = this;
  }
  accept<Ret, Arg>(
    visitors: Record<string, SQLPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitTableAlias(this, arg);
  }
  replaceChild(
    current: PlanTupleOperator,
    replacement: PlanTupleOperator,
  ): void {
    replacement.parent = this;
    this.source = replacement as TupleFnSource | TupleSource | LangSwitch;
  }
  override getChildren(): PlanOperator[] {
    return [this.source];
  }
  clone(): TableAlias {
    const res = new TableAlias(this.lang, this.alias, this.source.clone());
    res.schema = this.schema.slice();
    res.schemaSet = this.schemaSet.clone();
    return res;
  }
}
