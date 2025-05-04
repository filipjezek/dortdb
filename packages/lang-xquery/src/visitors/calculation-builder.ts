import { CalculationBuilder, CalculationParams } from '@dortdb/core';
import { ProjectionSize, TreeJoin, XQueryPlanVisitor } from '../plan/index.js';

export class XQueryCalculationBuilder
  extends CalculationBuilder
  implements XQueryPlanVisitor<CalculationParams>
{
  visitTreeJoin(operator: TreeJoin): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: this.assertMaxOne,
      argMeta: [{}],
    };
  }
  visitProjectionSize(operator: ProjectionSize): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: this.assertMaxOne,
      argMeta: [{}],
    };
  }
}
