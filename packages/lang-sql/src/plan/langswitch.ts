import { LogicalPlanTupleOperator } from '@dortdb/core';
import { LangSwitchResolver } from '../visitors/langswitch-resolver.js';
import { LangSwitch as ASTLangSwitch } from '@dortdb/core';
import { Trie } from 'mnemonist';
import { SQLLogicalPlanVisitor } from './index.js';

/**
 * This operator is a temporary operator which is replaced in {@link LangSwitchResolver}.
 */
export class LangSwitch extends LogicalPlanTupleOperator {
  public alias: string;

  constructor(
    lang: Lowercase<string>,
    public node: ASTLangSwitch,
  ) {
    super();
    this.lang = lang;
    this.schema = [];
    this.schemaSet = new Trie<(string | symbol)[]>(Array);
  }
  accept<Ret, Arg>(
    visitors: Record<string, SQLLogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitLangSwitch(this, arg);
  }
  replaceChild(
    current: LogicalPlanTupleOperator,
    replacement: LogicalPlanTupleOperator,
  ): void {}
}
