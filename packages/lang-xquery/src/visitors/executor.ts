import { ASTIdentifier, ExecutionContext, Executor } from '@dortdb/core';
import { ProjectionSize, TreeJoin, XQueryPlanVisitor } from '../plan/index.js';
import { XQueryLanguage } from '../language/language.js';
import { ItemSource } from '@dortdb/core/plan';

export class XQueryExecutor
  extends Executor
  implements XQueryPlanVisitor<Iterable<unknown>, ExecutionContext>
{
  protected adapter = (this.db.langMgr.getLang('xquery') as XQueryLanguage)
    .dataAdapter;

  visitTreeJoin(operator: TreeJoin, ctx: ExecutionContext): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitProjectionSize(
    operator: ProjectionSize,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }

  override visitItemSource(operator: ItemSource, ctx: ExecutionContext) {
    return [this.db.getSource((operator.name as ASTIdentifier).parts)];
  }
}
