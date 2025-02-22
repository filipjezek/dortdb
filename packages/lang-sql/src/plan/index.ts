import { LogicalPlanVisitor } from '@dortdb/core';
import { LangSwitch } from './langswitch.js';
import { Using } from './using.js';

export interface SQLLogicalPlanVisitor<Ret, Arg = never>
  extends LogicalPlanVisitor<Ret, Arg> {
  visitLangSwitch(operator: LangSwitch, arg?: Arg): Ret;
  visitUsing(operator: Using, arg?: Arg): Ret;
}
export * from './langswitch.js';
export * from './using.js';
