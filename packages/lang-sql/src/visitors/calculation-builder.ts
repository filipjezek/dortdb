import { CalculationBuilder, CalculationParams } from '@dortdb/core';
import { LangSwitch, SQLLogicalPlanVisitor, Using } from '../plan/index.js';

export class SQLCalculationBuilder
  extends CalculationBuilder
  implements SQLLogicalPlanVisitor<CalculationParams>
{
  visitLangSwitch(operator: LangSwitch): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
  visitUsing(operator: Using): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
}
