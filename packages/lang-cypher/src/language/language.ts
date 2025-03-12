import { ASTIdentifier, Language } from '@dortdb/core';
import { CypherLogicalPlanBuilder } from '../visitors/builder.js';
import { createParser } from './create-parser.js';
import { CypherDataAdaper, GraphologyDataAdapter } from './data-adapter.js';

export interface CypherConfig {
  adapter?: CypherDataAdaper;
  defaultGraph: string;
}

export interface CypherLanguage extends Language<'cypher'> {
  dataAdapter: CypherDataAdaper;
  defaultGraph: ASTIdentifier;
}

export function Cypher(config?: CypherConfig): CypherLanguage {
  return {
    name: 'cypher',
    operators: [],
    aggregates: [],
    functions: [],
    castables: [],
    visitors: {
      logicalPlanBuilder: CypherLogicalPlanBuilder,
    },
    createParser,
    dataAdapter: config?.adapter ?? new GraphologyDataAdapter(),
    defaultGraph:
      config?.defaultGraph && ASTIdentifier.fromParts([config.defaultGraph]),
  };
}
