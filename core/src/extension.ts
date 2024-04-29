import { operators } from './operators/index.js';

export interface Operator {
  name: string;
  impl: (...args: any[]) => any;
}

export interface Fn {
  name: string;
  impl: (...args: any[]) => any;
}

export enum AggregatorInvocation {
  INITIAL,
  ITERATE,
  FINAL,
}
export interface AggregatorFn {
  name: string;
  impl: (invocationType: AggregatorInvocation, ...args: any[]) => any;
}

export interface Extension<LangNames extends string = string> {
  schema?: string;
  operators: Operator[];
  functions: Fn[];
  aggregators: AggregatorFn[];
  scope?: LangNames[];
}

export const core: Extension = {
  operators: operators,
  functions: [],
  aggregators: [],
};
