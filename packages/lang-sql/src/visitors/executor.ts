import {
  allAttrs,
  DortDBAsFriend,
  ExecutionContext,
  Executor,
  PlanTupleOperator,
  PlanVisitor,
} from '@dortdb/core';
import { LangSwitch, SQLPlanVisitor, Using } from '../plan/index.js';
import { SQLLanguage } from '../language/language.js';

export class SQLExecutor
  extends Executor
  implements SQLPlanVisitor<Iterable<unknown>, ExecutionContext>
{
  protected adapter = (this.db.langMgr.getLang('sql') as SQLLanguage)
    .dataAdapter;

  constructor(
    vmap: Record<string, PlanVisitor<Iterable<unknown>, ExecutionContext>>,
    db: DortDBAsFriend,
  ) {
    super('sql', vmap, db);
  }

  visitLangSwitch(
    operator: LangSwitch,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitUsing(operator: Using, ctx: ExecutionContext): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }

  protected override *generateTuplesFromValues(
    values: Iterable<unknown>,
    operator: PlanTupleOperator,
    ctx: ExecutionContext,
  ) {
    const keys = operator.schema
      .filter((x) => x.parts[0] !== allAttrs)
      .map((attr) => ctx.getTranslation(operator, attr.parts));
    const allAttrsKey = ctx.translations.get(operator).scope.get([allAttrs])
      ?.parts[0] as number;
    const accessors = [];
    for (let i = 0; i < keys.length; i++) {
      const ps = operator.schema[i].parts;
      accessors[keys[i]] = this.adapter.createColumnAccessor(ps.at(-1));
    }

    for (const item of values) {
      const result: unknown[] = [];
      for (const key of keys) {
        result[key] = ctx.variableValues[key] = accessors[key](item);
      }
      if (allAttrsKey !== undefined) {
        result[allAttrsKey] = ctx.variableValues[allAttrsKey] = item;
      }
      yield result;
    }
  }
}
