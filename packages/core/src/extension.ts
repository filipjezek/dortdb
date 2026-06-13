import * as aggregates from './aggregates/index.js';
import { ASTIdentifier } from './ast.js';
import * as castables from './castables/index.js';
import * as operators from './operators/index.js';
import * as fns from './functions/index.js';

/** An operator used in queries. For example, math operators like +, -, *, ... */
export interface Operator {
  /** Unique name used to look up this operator. */
  name: string;
  /** Implementation function; receives operand values and returns the result. */
  impl: (...args: any[]) => any;
}

/** A function used in queries. For example, string manipulation functions. */
export interface Fn {
  /** Unique name used to look up this function. */
  name: string;
  /** Schema (name prefix) of the function. */
  schema?: string | symbol;
  /** If the function is used as a tuple source, this is the schema of its output. */
  outputSchema?: ASTIdentifier[];
  /** Implementation function; receives argument values and returns the result. */
  impl: (...args: any[]) => any;
  /** No side effects, same output for same input (careful: `() => ({})` is not pure). */
  pure?: boolean;
}

/** Aggregator used in queries. For example, sum or count. */
export interface AggregateFn {
  /** Unique name used to look up this aggregate function. */
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
  /** By default, aggregates ignore nulls. Set this to true to include nulls in the operation. */
  includeNulls?: boolean;
}

/** A keyword to cast values to a specific type. For example, in SQL's `CAST val AS date`, `date` is a castable. */
export interface Castable {
  /** Unique name of this castable keyword. */
  name: string;
  /** Schema (name prefix) of the castable. */
  schema?: string | symbol;
  /** No side effects, same output for same input (careful: `() => ({})` is not pure). */
  pure?: boolean;
  /** Converts a value to the target type. */
  convert: (val: any) => any;
}

/** A bundle of operators, functions, aggregates, and castables that can be registered with the engine. */
export interface Extension<LangNames extends string = string> {
  /** Schema (name prefix) of the extension, applied to all of its functions, aggregates, and castables. */
  schema?: string;
  /** Operators contributed by this extension. */
  operators?: Operator[];
  /** Functions contributed by this extension. */
  functions?: Fn[];
  /** Aggregate functions contributed by this extension. */
  aggregates?: AggregateFn[];
  /** Castable type keywords contributed by this extension. */
  castables?: Castable[];
  /** If specified, will limit the extension to only specific languages. */
  scope?: LangNames[];
}

/** Built-in extension bundling the core operators, functions, aggregates, and castables available in all languages. */
export const core: Extension = {
  operators: Object.values(operators),
  functions: Object.values(fns),
  aggregates: Object.values(aggregates),
  castables: Object.values(castables),
};
