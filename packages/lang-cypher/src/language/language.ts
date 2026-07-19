import { ASTIdentifier, Fn, Language, SerializeFn } from '@dortdb/core';
import { CypherLogicalPlanBuilder } from '../visitors/builder.js';
import { createParser } from './create-parser.js';
import { CypherDataAdapter } from './data-adapter.js';
import { CypherExecutor } from '../visitors/executor.js';
import { serializeToObjects } from '@dortdb/core/utils';
import * as fns from '../functions/index.js';
import * as ops from '../operators/index.js';
import { GraphologyDataAdapter } from './graphology-adapter.js';

/**
 * Configuration for the Cypher language.
 */
export interface CypherConfig {
  /** Data adapter for accessing graph data. Uses {@link GraphologyDataAdapter} by default */
  adapter?: CypherDataAdapter;
  /** The default graph to query against. */
  defaultGraph: string;
  /** Function to serialize query results. */
  serialize?: SerializeFn;
}

/** Runtime language descriptor for Cypher, extending the core {@link Language} contract with graph-specific fields. */
export interface CypherLanguage extends Language<'cypher'> {
  /** Graph data adapter used by built-in functions and the executor. */
  dataAdapter: CypherDataAdapter;
  /** Default graph identifier resolved from {@link CypherConfig.defaultGraph}. */
  defaultGraph: ASTIdentifier;
}

/**
 * Creates a new Cypher language instance.
 * @param config Configuration options for the Cypher language.
 * @returns A new Cypher language instance.
 * @example
 * ```ts
 * import { DortDB } from '@dortdb/core';
 * import { Cypher } from '@dortdb/lang-cypher';
 *
 * const db = new DortDB({ mainLang: Cypher({ defaultGraph: 'g' }) });
 * db.query('MATCH (n) RETURN n');
 * ```
 */
export function Cypher(config?: CypherConfig): CypherLanguage {
  return {
    name: 'cypher',
    operators: [...Object.values(ops)],
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

/** Extension of {@link Fn} for Cypher built-in functions that may require graph adapter injection. */
export interface CypherFn extends Fn {
  /** When `true`, the runtime prepends an {@link AdapterCtxArg} as the first argument before calling `impl`. */
  addAdapterCtx?: boolean;
}
/** Adapter context injected as the first argument of any {@link CypherFn} with `addAdapterCtx: true`. */
export interface AdapterCtxArg {
  /** The active {@link CypherDataAdapter} for the current execution. */
  adapter: CypherDataAdapter;
  /** The graph instance being queried. */
  graph: unknown;
}
