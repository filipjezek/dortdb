import { Language, SerializeFn } from '@dortdb/core';
import { coalesce } from '../functions/coalesce.js';
import { SQLLogicalPlanBuilder } from '../visitors/builder.js';
import { SQLCalculationBuilder } from '../visitors/calculation-builder.js';
import { ObjectDataAdapter, SQLDataAdapter } from './data-adapter.js';
import { createParser } from './create-parser.js';
import { between, inOp, notInOp } from '../operators/basic.js';
import { SQLEqualityChecker } from '../visitors/equality-checker.js';
import { SQLExecutor } from '../visitors/executor.js';
import { serializeToObjects } from '@dortdb/core/utils';
import { objAccess, objMatch } from '../operators/json.js';
import { concat, ilike, like } from '../operators/string.js';

export interface SQLConfig {
  /** defaults to {@link ObjectDataAdapter} */
  adapter?: SQLDataAdapter;
  serialize: SerializeFn;
}

export interface SQLLanguage extends Language<'sql'> {
  dataAdapter: SQLDataAdapter;
}

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
    functions: [coalesce],
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
