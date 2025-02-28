import { Language } from '@dortdb/core';
import { coalesce } from '../functions/coalesce.js';
import { SQLLogicalPlanBuilder } from '../visitors/builder.js';
import { SQLCalculationBuilder } from '../visitors/calculation-builder.js';
import { ObjectDataAdapter, SQLDataAdapter } from './data-adapter.js';
import { createParser } from './create-parser.js';

export interface SQLConfig {
  /** defaults to {@link ObjectDataAdapter} */
  adapter?: SQLDataAdapter;
}

export interface SQLLanguage extends Language<'sql'> {
  dataAdapter: SQLDataAdapter;
}

export function SQL(config?: SQLConfig): SQLLanguage {
  return {
    name: 'sql',
    operators: [],
    aggregates: [],
    functions: [coalesce],
    castables: [],
    createParser,
    visitors: {
      logicalPlanBuilder: SQLLogicalPlanBuilder,
      calculationBuilder: SQLCalculationBuilder,
    },
    dataAdapter: config?.adapter ?? new ObjectDataAdapter(),
  };
}
