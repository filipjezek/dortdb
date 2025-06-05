import { CalculationBuilder, CalculationParams } from '@dortdb/core';
import { ProjectionSize, TreeJoin, XQueryPlanVisitor } from '../plan/index.js';
import { assertMaxOne } from '@dortdb/core/internal-fns';

export class XQueryCalculationBuilder
  extends CalculationBuilder
  implements XQueryPlanVisitor<CalculationParams>
{
  visitTreeJoin(operator: TreeJoin): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitProjectionSize(operator: ProjectionSize): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
}
