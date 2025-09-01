import * as aggregates from './aggregates/index.js';
import { ASTIdentifier } from './ast.js';
import * as castables from './castables/index.js';
import * as operators from './operators/index.js';
import * as fns from './functions/index.js';

/** An operator used in queries. For example, math operators like +, -, *... */
export interface Operator {
  name: string;
  impl: (...args: any[]) => any;
}

/** A function used in queries. For example, string manipulation functions. */
export interface Fn {
  name: string;
  /** Schema (name prefix) of the function. */
  schema?: string | symbol;
  /** If the function is used as a tuple source, this is the schema of its output. */
  outputSchema?: ASTIdentifier[];
  impl: (...args: any[]) => any;
  /** No side effects, same output for same input (careful: `() => ({})` is not pure). */
  pure?: boolean;
}

/** Aggregator used in queries. For example, sum or count. */
export interface AggregateFn {
  name: string;
  /** Schema (name prefix) of the function. */
  schema?: string | symbol;
  /** Called before receiving any values, should prepare the aggregator state. */
  init: () => any;
  /** Receive the current state and the next value, should return the next state. */
  step: (state: any, ...vals: any[]) => any;
  /**
   * Optional inverse step function for speeding up window functions.
   */
  stepInverse?: (state: any, ...vals: any[]) => any;
  /** Receive the current state, should extract the aggregation result. */
  result: (state: any) => any;
}

/** A keyword to cast values to a specific type. For example, in SQL's `CAST val AS date`, `date` is a castable. */
export interface Castable {
  name: string;
  /** Schema (name prefix) of the castable. */
  schema?: string | symbol;
  /** No side effects, same output for same input (careful: `() => ({})` is not pure). */
  pure?: boolean;
  convert: (val: any) => any;
}

export interface Extension<LangNames extends string = string> {
  /** Schema (name prefix) of the extension, applied to all of its functions, aggregates, and castables. */
  schema?: string;
  operators?: Operator[];
  functions?: Fn[];
  aggregates?: AggregateFn[];
  castables?: Castable[];
  /** If specified, will limit the extension to only specific languages. */
  scope?: LangNames[];
}

export const core: Extension = {
  operators: Object.values(operators),
  functions: Object.values(fns),
  aggregates: Object.values(aggregates),
  castables: Object.values(castables),
};
