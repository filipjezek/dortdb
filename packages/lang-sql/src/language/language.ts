import { Language, SerializeFn } from '@dortdb/core';
import { SQLLogicalPlanBuilder } from '../visitors/builder.js';
import { SQLCalculationBuilder } from '../visitors/calculation-builder.js';
import { ObjectDataAdapter, SQLDataAdapter } from './data-adapter.js';
import { createParser } from './create-parser.js';
import { SQLEqualityChecker } from '../visitors/equality-checker.js';
import { SQLExecutor } from '../visitors/executor.js';
import { serializeToObjects } from '@dortdb/core/utils';
import { coalesce, substr } from '../functions/index.js';
import {
  inOp,
  notInOp,
  objAccess,
  concat,
  objMatch,
  like,
  ilike,
  between,
} from '../operators/index.js';

/**
 * Configuration for the SQL language.
 */
export interface SQLConfig {
  /** defaults to {@link ObjectDataAdapter} */
  adapter?: SQLDataAdapter;
  /** Function to serialize query results. */
  serialize: SerializeFn;
}

/** A configured SQL language instance, extending {@link Language} with the active data adapter. */
export interface SQLLanguage extends Language<'sql'> {
  /** The data adapter used to convert between plain values and table rows. */
  dataAdapter: SQLDataAdapter;
}

/**
 * Creates a new SQL language instance.
 * @param config Configuration options for the SQL language.
 * @returns A new SQL language instance.
 * @example
 * ```ts
 * import { DortDB } from '@dortdb/core';
 * import { SQL } from '@dortdb/lang-sql';
 *
 * const db = new DortDB({ mainLang: SQL() });
 * db.query('SELECT 1 AS one');
 * ```
 */
export function SQL(config?: SQLConfig): SQLLanguage {
  return {
    name: 'sql',
    operators: [
      inOp,
      notInOp,
      objAccess,
      concat,
      objMatch,
      like,
      ilike,
      between,
    ],
    aggregates: [],
    functions: [coalesce, substr],
    castables: [],
    createParser,
    visitors: {
      logicalPlanBuilder: SQLLogicalPlanBuilder,
      calculationBuilder: SQLCalculationBuilder,
      equalityChecker: SQLEqualityChecker,
      executor: SQLExecutor,
    },
    dataAdapter: config?.adapter ?? new ObjectDataAdapter(),
    serialize: config?.serialize ?? serializeToObjects(),
  };
}
