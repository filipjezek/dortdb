import { CalculationBuilder, CalculationParams } from '@dortdb/core';
import { ProjectionSize, TreeJoin, XQueryPlanVisitor } from '../plan/index.js';
import { FnCall } from '@dortdb/core/plan';
import { XQueryLanguage } from '../language/language.js';
import { assertMaxOne } from '@dortdb/core/internal-fns';

export class XQueryCalculationBuilder
  extends CalculationBuilder
  implements XQueryPlanVisitor<CalculationParams>
{
  private adapter = this.db.langMgr.getLang<'xquery', XQueryLanguage>('xquery')
    .dataAdapter;

  visitTreeJoin(operator: TreeJoin): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{}],
    };
  }
  visitProjectionSize(operator: ProjectionSize): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{}],
    };
  }

  override visitFnCall(operator: FnCall): CalculationParams {
    const res = super.visitFnCall(operator);
    const oldImpl = res.impl;
    res.impl = (...args) =>
      oldImpl(...args.map((a) => this.adapter.atomize(a)));
    return res;
  }
}
