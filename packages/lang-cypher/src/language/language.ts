import { ASTIdentifier, Fn, Language, SerializeFn } from '@dortdb/core';
import { CypherLogicalPlanBuilder } from '../visitors/builder.js';
import { createParser } from './create-parser.js';
import { CypherDataAdaper, GraphologyDataAdapter } from './data-adapter.js';
import { CypherExecutor } from '../visitors/executor.js';
import { serializeToObjects } from '@dortdb/core/utils';
import * as fns from '../functions/index.js';

export interface CypherConfig {
  adapter?: CypherDataAdaper;
  defaultGraph: string;
  serialize?: SerializeFn;
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
    functions: [...Object.values(fns)],
    castables: [],
    visitors: {
      logicalPlanBuilder: CypherLogicalPlanBuilder,
      executor: CypherExecutor,
    },
    createParser,
    dataAdapter: config?.adapter ?? new GraphologyDataAdapter(),
    defaultGraph:
      config?.defaultGraph && ASTIdentifier.fromParts([config.defaultGraph]),
    serialize: config?.serialize ?? serializeToObjects(),
  };
}

export interface CypherFn extends Fn {
  addAdapterCtx?: boolean;
}
export interface AdapterCtxArg {
  adapter: CypherDataAdaper;
  graph: unknown;
}
