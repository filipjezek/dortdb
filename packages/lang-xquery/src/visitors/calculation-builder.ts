import { CalculationBuilder, CalculationParams } from '@dortdb/core';
import {
  ProjectionSize,
  TreeJoin,
  XQueryLogicalPlanVisitor,
} from '../plan/index.js';

export class XQueryCalculationBuilder
  extends CalculationBuilder
  implements XQueryLogicalPlanVisitor<CalculationParams>
{
  visitTreeJoin(operator: TreeJoin): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
  visitProjectionSize(operator: ProjectionSize): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
}
