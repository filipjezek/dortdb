import {
  AggregateFn,
  Castable,
  Fn,
  Language,
  Operator,
  QueryResult,
  SerializeFn,
} from '@dortdb/core';
import { count } from '@dortdb/core/aggregates';
import { XQueryLogicalPlanBuilder } from '../visitors/builder.js';
import { castables } from '../castables/index.js';
import { XQueryCalculationBuilder } from '../visitors/calculation-builder.js';
import * as fns from '../functions/index.js';
import * as operators from '../operators/index.js';
import { createParser } from './create-parser.js';
import { XQueryDataAdapter, DomDataAdapter } from './data-adapter.js';
import { XQueryTransitiveDependencies } from '../visitors/transitive-deps.js';
import { XQueryAttributeRenameChecker } from '../visitors/attr-rename-checker.js';
import { XQueryAttributeRenamer } from '../visitors/attr-renamer.js';
import { XQueryEqualityChecker } from '../visitors/equality-checker.js';
import { XQueryVariableMapper } from '../visitors/variable-mapper.js';
import { XQueryExecutor } from '../visitors/executor.js';
import { serializeToObjects } from '@dortdb/core/utils';

/**
 * Configuration for the XQuery language.
 */
export interface XQueryConfig {
  /** defaults to {@link DomDataAdapter} */
  adapter?: XQueryDataAdapter;
  /**
   * Function to serialize query results.
   */
  serialize?: SerializeFn;
}
export interface XQueryLanguage extends Language<'xquery'> {
  dataAdapter: XQueryDataAdapter;
}

/**
 * Creates a new XQuery language instance.
 * @param config Configuration options for the XQuery language.
 * @returns A new XQuery language instance.
 */
export function XQuery(config?: XQueryConfig): XQueryLanguage {
  const dataAdapter = config?.adapter ?? new DomDataAdapter(document);
  return {
    name: 'xquery',
    operators: [...Object.values(operators)],
    aggregates: [{ ...count, schema: 'fn' }],
    functions: [...Object.values(fns)],
    castables,
    createParser,
    visitors: {
      logicalPlanBuilder: XQueryLogicalPlanBuilder,
      calculationBuilder: XQueryCalculationBuilder,
      transitiveDependencies: XQueryTransitiveDependencies,
      attributeRenameChecker: XQueryAttributeRenameChecker,
      attributeRenamer: XQueryAttributeRenamer,
      equalityChecker: XQueryEqualityChecker,
      variableMapper: XQueryVariableMapper,
      executor: XQueryExecutor,
    },
    dataAdapter,
    serialize: config?.serialize ?? serializeToObjects('.'),
  };
}

export interface XQueryFn extends Fn {
  skipAtomization?: boolean;
}
export interface XQueryOp extends Operator {
  skipAtomization?: boolean;
}
export interface XQueryAggregate extends AggregateFn {
  skipAtomization?: boolean;
}
export interface XQueryCastable extends Castable {
  skipAtomization?: boolean;
}
