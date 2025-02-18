import * as aggregates from './aggregates/index.js';
import { ASTIdentifier } from './ast.js';
import * as castables from './castables/index.js';
import * as operators from './operators/index.js';
import * as fns from './functions/index.js';

export interface Operator {
  name: string;
  impl: (...args: any[]) => any;
}

export interface Fn {
  name: string;
  schema?: string | symbol;
  outputSchema?: ASTIdentifier[];
  impl: (...args: any[]) => any;
  // no side effects, same output for same input (careful: `() => ({})` is not pure)
  pure?: boolean;
}

export interface AggregateFn {
  name: string;
  schema?: string | symbol;
  init: () => any;
  step: (state: any, ...vals: any[]) => any;
  /**
   * Optional inverse step function for speeding up window functions
   */
  stepInverse?: (state: any, ...vals: any[]) => any;
  result: (state: any) => any;
}

export interface Castable {
  name: string;
  schema?: string | symbol;
  pure?: boolean;
  convert: (val: any) => any;
}

export interface Extension<LangNames extends string = string> {
  schema?: string;
  operators?: Operator[];
  functions?: Fn[];
  aggregates?: AggregateFn[];
  castables?: Castable[];
  scope?: LangNames[];
}

export const core: Extension = {
  operators: Object.values(operators),
  functions: Object.values(fns),
  aggregates: Object.values(aggregates),
  castables: Object.values(castables),
};
