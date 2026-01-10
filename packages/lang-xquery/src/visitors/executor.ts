import {
  ASTIdentifier,
  DortDBAsFriend,
  ExecutionContext,
  Executor,
  PlanVisitor,
} from '@dortdb/core';
import { ProjectionSize, TreeJoin, XQueryPlanVisitor } from '../plan/index.js';
import { XQueryLanguage } from '../language/language.js';
import { ItemSource } from '@dortdb/core/plan';
import { toArray } from '@dortdb/core/internal-fns';
import { DOT, POS, LEN } from '../utils/dot.js';

const ctxCols = [DOT, POS, LEN];

export class XQueryExecutor
  extends Executor
  implements XQueryPlanVisitor<Iterable<unknown>, ExecutionContext>
{
  protected adapter = (this.db.langMgr.getLang('xquery') as XQueryLanguage)
    .dataAdapter;

  constructor(
    vmap: Record<string, PlanVisitor<Iterable<unknown>, ExecutionContext>>,
    db: DortDBAsFriend,
  ) {
    super('xquery', vmap, db);
  }

  *visitTreeJoin(operator: TreeJoin, ctx: ExecutionContext): Iterable<unknown> {
    const ts = ctx.translations.get(operator).scope;
    const keys = operator.schema
      .filter((x) => !ctxCols.includes(x))
      .map((x) => ts.get(x.parts).parts[0] as number);
    const dotKey = ts.get(DOT.parts).parts[0] as number;
    const posKey = ts.get(POS.parts).parts[0] as number;
    const lenKey = ts.get(LEN.parts).parts[0] as number;
    const nodeSet = new Set<unknown>();
    for (const leftItem of operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      let rightItems: unknown[] = this.visitCalculation(operator.step, ctx);
      if (Array.isArray(rightItems[0])) {
        rightItems = rightItems[0];
      }
      for (let i = 0; i < rightItems.length; i++) {
        const result: unknown[] = [];
        const rightItem = rightItems[i];
        if (operator.removeDuplicates && this.adapter.isNode(rightItem)) {
          if (nodeSet.has(rightItem)) continue;
          nodeSet.add(rightItem);
        }
        for (const key of keys) {
          result[key] = ctx.variableValues[key] = leftItem[key];
        }
        result[dotKey] = ctx.variableValues[dotKey] = rightItem;
        result[posKey] = ctx.variableValues[posKey] = i + 1;
        result[lenKey] = ctx.variableValues[lenKey] = rightItems.length;
        yield ctx.setTuple(result, keys);
      }
    }
  }

  *visitProjectionSize(
    operator: ProjectionSize,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const items = toArray(
      operator.source.accept(this.vmap, ctx) as Iterable<unknown[]>,
    );
    const size = items.length;
    const sizeKey = operator.sizeCol.parts[0] as number;
    const keys = ctx.getKeys(operator.source);
    for (const item of items) {
      const result: unknown[] = [];
      for (const key of keys) {
        result[key] = item[key];
      }
      result[sizeKey] = ctx.variableValues[sizeKey] = size;
      yield ctx.setTuple(result, keys);
    }
  }

  override visitItemSource(operator: ItemSource, ctx: ExecutionContext) {
    return [this.db.getSource((operator.name as ASTIdentifier).parts)];
  }
}
