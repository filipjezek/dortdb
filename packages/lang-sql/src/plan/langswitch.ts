import { PlanOperator, PlanTupleOperator } from '@dortdb/core';
import { LangSwitch as ASTLangSwitch } from '@dortdb/core';
import { Trie } from '@dortdb/core/data-structures';
import { SQLPlanVisitor } from './index.js';

/**
 * This operator is a temporary operator which is replaced in {@link LangSwitchResolver}.
 */
export class LangSwitch extends PlanTupleOperator {
  public alias: string;

  constructor(
    lang: Lowercase<string>,
    public node: ASTLangSwitch,
  ) {
    super();
    this.lang = lang;
    this.schema = [];
    this.schemaSet = new Trie<string | symbol>();
  }
  accept<Ret, Arg>(
    visitors: Record<string, SQLPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitLangSwitch(this, arg);
  }
  replaceChild(
    current: PlanTupleOperator,
    replacement: PlanTupleOperator,
  ): void {
    throw new Error('Method not implemented.');
  }
  override getChildren(): PlanOperator[] {
    return [];
  }
  clone(): LangSwitch {
    const res = new LangSwitch(this.lang, this.node);
    res.alias = this.alias;
    res.schema = this.schema.slice();
    res.schemaSet = this.schemaSet.clone();
    return res;
  }
}
