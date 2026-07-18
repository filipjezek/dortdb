import {
  AggregateFn,
  Castable,
  Fn,
  Language,
  Operator,
  SerializeFn,
} from '@dortdb/core';
import { count } from '@dortdb/core/aggregates';
import { XQueryLogicalPlanBuilder } from '../visitors/builder.js';
import { castables } from '../castables/index.js';
import { XQueryCalculationBuilder } from '../visitors/calculation-builder.js';
import * as fns from '../functions/index.js';
import * as operators from '../operators/index.js';
import * as aggregates from '../aggregates/index.js';
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
/** The assembled language descriptor for XQuery, as returned by {@link XQuery}. */
export interface XQueryLanguage extends Language<'xquery'> {
  /** The active data adapter used for node creation and tree traversal. */
  dataAdapter: XQueryDataAdapter;
}

/**
 * Creates a new XQuery language instance.
 * @param config Configuration options for the XQuery language.
 * @returns A new XQuery language instance.
 * @example
 * ```ts
 * import { DortDB } from '@dortdb/core';
 * import { XQuery } from '@dortdb/lang-xquery';
 *
 * const db = new DortDB({ mainLang: XQuery() });
 * db.query('<greeting>{ 1 + 1 }</greeting>');
 * ```
 */
export function XQuery(config?: XQueryConfig): XQueryLanguage {
  const dataAdapter = config?.adapter ?? new DomDataAdapter(document);
  return {
    name: 'xquery',
    operators: [...Object.values(operators)],
    aggregates: [{ ...count, schema: 'fn' }, ...Object.values(aggregates)],
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

/** XQuery-specific extension of {@link Fn} that can suppress automatic argument atomization. */
export interface XQueryFn extends Fn {
  /** When `true`, arguments are passed as-is, bypassing XQuery atomization. */
  skipAtomization?: boolean;
}
/** XQuery-specific extension of {@link Operator} that can suppress automatic argument atomization. */
export interface XQueryOp extends Operator {
  /** When `true`, operands are not atomized before the operator is evaluated. */
  skipAtomization?: boolean;
}
/** XQuery-specific extension of {@link AggregateFn} that can suppress automatic atomization. */
export interface XQueryAggregate extends AggregateFn {
  /** When `true`, values are not atomized before being passed to the aggregate steps. */
  skipAtomization?: boolean;
}
/** XQuery-specific extension of {@link Castable} that can suppress automatic atomization. */
export interface XQueryCastable extends Castable {
  /** When `true`, values are not atomized before the cast is attempted. */
  skipAtomization?: boolean;
}
