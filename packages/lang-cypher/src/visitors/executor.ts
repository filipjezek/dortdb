import {
  ASTIdentifier,
  DortDBAsFriend,
  ExecutionContext,
  Executor,
  PlanVisitor,
} from '@dortdb/core';
import { ItemSource } from '@dortdb/core/plan';
import { CypherLanguage } from '../language/language.js';

/**
 * Executes a Cypher logical plan against the registered graph data source,
 * delegating all generic plan operators to the base {@link Executor} and
 * handling the Cypher-specific {@link ItemSource} dispatch.
 */
export class CypherExecutor extends Executor {
  /** Graph data adapter obtained from the Cypher language registration. */
  protected adapter = (this.db.langMgr.getLang('cypher') as CypherLanguage)
    .dataAdapter;

  constructor(
    vmap: Record<string, PlanVisitor<Iterable<unknown>, ExecutionContext>>,
    db: DortDBAsFriend,
  ) {
    super('cypher', vmap, db);
  }

  /**
   * Resolves an {@link ItemSource} to either the node or edge iterable of the
   * named graph, dispatching on the last part of `operator.name` (`'nodes'` or
   * `'edges'`).
   */
  override visitItemSource(
    operator: ItemSource,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    const name = operator.name as ASTIdentifier;
    const source = this.db.getSource(name.parts.slice(0, -1));
    const type = name.parts.at(-1);

    if (type === 'nodes') return this.adapter.filterNodes(source);
    return this.adapter.filterEdges(source);
  }
}
