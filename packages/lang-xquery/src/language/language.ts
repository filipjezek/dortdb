import { Language } from '@dortdb/core';
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

export interface XQueryConfig {
  /** defaults to {@link DomDataAdapter} */
  adapter?: XQueryDataAdapter;
}
export interface XQueryLanguage extends Language<'xquery'> {
  dataAdapter: XQueryDataAdapter;
}
export function XQuery(config?: XQueryConfig): XQueryLanguage {
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
    },
    dataAdapter: config?.adapter ?? new DomDataAdapter(document),
  };
}
