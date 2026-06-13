import { PlanVisitor } from '@dortdb/core';
import { LangSwitch } from './langswitch.js';
import { Using } from './using.js';
import { TableAlias } from './table-alias.js';

/**
 * Extends {@link PlanVisitor} with the SQL-specific plan operators
 * {@link LangSwitch}, {@link Using}, and {@link TableAlias}.
 */
export interface SQLPlanVisitor<Ret, Arg = never> extends PlanVisitor<
  Ret,
  Arg
> {
  visitLangSwitch(operator: LangSwitch, arg?: Arg): Ret;
  visitUsing(operator: Using, arg?: Arg): Ret;
  visitTableAlias(operator: TableAlias, arg?: Arg): Ret;
}
export * from './langswitch.js';
export * from './using.js';
export * from './table-alias.js';
