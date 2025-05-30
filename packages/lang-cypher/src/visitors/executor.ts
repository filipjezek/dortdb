import {
  ASTIdentifier,
  DortDBAsFriend,
  ExecutionContext,
  Executor,
  PlanVisitor,
} from '@dortdb/core';
import { ItemSource } from '@dortdb/core/plan';
import { CypherLanguage } from '../language/language.js';

export class CypherExecutor extends Executor {
  protected adapter = (this.db.langMgr.getLang('cypher') as CypherLanguage)
    .dataAdapter;

  constructor(
    vmap: Record<string, PlanVisitor<Iterable<unknown>, ExecutionContext>>,
    db: DortDBAsFriend,
  ) {
    super('cypher', vmap, db);
  }

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
