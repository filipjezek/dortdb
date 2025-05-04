import { CalculationBuilder, CalculationParams } from '@dortdb/core';
import { LangSwitch, SQLPlanVisitor, Using } from '../plan/index.js';

export class SQLCalculationBuilder
  extends CalculationBuilder
  implements SQLPlanVisitor<CalculationParams>
{
  visitLangSwitch(operator: LangSwitch): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: this.assertMaxOne,
      argMeta: [{}],
    };
  }
  visitUsing(operator: Using): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: this.assertMaxOne,
      argMeta: [{}],
    };
  }
}
