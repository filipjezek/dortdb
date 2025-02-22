import {
  ContextPropagator,
  IdSet,
  LanguageManager,
  LogicalPlanTupleOperator,
} from '@dortdb/core';
import { LangSwitch } from '../plan/langswitch.js';
import { MapFromItem, MapToItem, Projection } from '@dortdb/core/plan';
import { DEFAULT_COLUMN } from './builder.js';
import { difference, overrideSource } from '@dortdb/core/utils';
import { SQLLogicalPlanVisitor, Using } from '../plan/index.js';

export class LangSwitchResolver
  extends ContextPropagator
  implements SQLLogicalPlanVisitor<void, IdSet>
{
  constructor(
    vmap: Record<string, LangSwitchResolver>,
    private langMgr: LanguageManager,
  ) {
    super(vmap, 'sql');
  }

  visitLangSwitch(op: LangSwitch, ctx: IdSet) {
    const nested = new (this.langMgr.getLang(
      op.node.lang,
    ).visitors.logicalPlanBuilder)(this.langMgr).buildPlan(op.node.node, ctx);
    let res = !(nested.plan instanceof LogicalPlanTupleOperator)
      ? new MapFromItem('sql', DEFAULT_COLUMN, nested.plan)
      : nested.plan;
    if (op.alias) {
      res = new Projection(
        'sql',
        res.schema.map((x) => [x, overrideSource(op.alias, x)]),
        res,
      );
    }

    const diff = difference(op.schemaSet, res.schemaSet);
    if (diff.size) {
      throw new Error(
        `Unresolved columns at language switch [SQL -> ${op.node.lang}]: ${Array.from<(string | symbol)[]>(diff).map((x) => x.join('.'))}`,
      );
    }

    op.parent.replaceChild(op, res);
  }

  visitUsing(operator: Using, ctx?: IdSet): void {
    throw new Error('Method not implemented.');
  }

  override visitMapToItem(operator: MapToItem, ctx: IdSet): void {
    const fromLS = operator.source instanceof LangSwitch;
    super.visitMapToItem(operator, ctx);
    if (fromLS && operator.source.schema.length === 1) {
      operator.key = operator.source.schema[0];
    }
  }
}
