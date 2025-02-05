import * as aggregates from './aggregates/index.js';
import { ASTIdentifier } from './ast.js';
import * as castables from './castables/index.js';
import * as operators from './operators/index.js';

export interface Operator {
  name: string;
  impl: (...args: any[]) => any;
}

export interface Fn {
  name: string;
  schema?: string | symbol;
  outputSchema?: ASTIdentifier[];
  impl: (...args: any[]) => any;
}

export interface AggregateFn {
  name: string;
  schema?: string | symbol;
  init: () => any;
  step: (acc: any, val: any) => any;
  /**
   * Optional inverse step function for speeding up window functions
   */
  stepInverse?: (acc: any, val: any) => any;
  result: (acc: any) => any;
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
  functions: [],
  aggregates: Object.values(aggregates),
  castables: Object.values(castables),
};
