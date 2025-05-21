import { ASTIdentifier, ExecutionContext, Executor } from '@dortdb/core';
import { LangSwitch, SQLPlanVisitor, Using } from '../plan/index.js';
import { TupleSource } from '@dortdb/core/plan';
import { SQLLanguage } from '../language/language.js';

export class SQLExecutor
  extends Executor
  implements SQLPlanVisitor<Iterable<unknown>, ExecutionContext>
{
  protected adapter = (this.db.langMgr.getLang('sql') as SQLLanguage)
    .dataAdapter;

  visitLangSwitch(
    operator: LangSwitch,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitUsing(operator: Using, ctx: ExecutionContext): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }

  override *visitTupleSource(
    operator: TupleSource,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const source = this.db.getSource((operator.name as ASTIdentifier).parts);
    const varmap = ctx.translations.get(operator);
    const addresses = operator.schema.map(
      (attr) => varmap.get(attr.parts).parts[0] as number,
    );
    const accessors = [];
    for (let i = 0; i < addresses.length; i++) {
      const ps = operator.schema[i].parts;
      accessors[addresses[i]] = this.adapter.createColumnAccessor(
        ps[ps.length - 1],
      );
    }

    for (const item of source as Iterable<unknown>) {
      const result: unknown[] = [];
      for (const addr of addresses) {
        result[addr] = ctx.variableValues[addr] = accessors[addr](item);
      }
      yield result;
    }
  }
}
