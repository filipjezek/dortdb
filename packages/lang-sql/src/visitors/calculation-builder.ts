import { CalculationBuilder, CalculationParams } from '@dortdb/core';
import {
  LangSwitch,
  SQLPlanVisitor,
  TableAlias,
  Using,
} from '../plan/index.js';
import { assertMaxOne } from '@dortdb/core/internal-fns';

export class SQLCalculationBuilder
  extends CalculationBuilder
  implements SQLPlanVisitor<CalculationParams>
{
  visitLangSwitch(operator: LangSwitch): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitUsing(operator: Using): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitTableAlias(operator: TableAlias, arg?: never): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
}
