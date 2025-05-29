import { VariableMapper, VariableMapperCtx } from '@dortdb/core';
import { ProjectionSize, TreeJoin, XQueryPlanVisitor } from '../plan/index.js';
import { DOT, LEN, POS } from '../utils/dot.js';

export class XQueryVariableMapper
  extends VariableMapper
  implements XQueryPlanVisitor<void, VariableMapperCtx>
{
  visitTreeJoin(operator: TreeJoin, ctx: VariableMapperCtx): void {
    operator.source.accept(this.vmap, ctx);
    this.setTranslations(operator, ctx);
    this.translate(DOT, ctx);
    this.translate(POS, ctx);
    this.translate(LEN, ctx);
    operator.step.accept(this.vmap, ctx);
  }
  visitProjectionSize(operator: ProjectionSize, ctx: VariableMapperCtx): void {
    operator.source.accept(this.vmap, ctx);
    this.setTranslations(operator, ctx);
    operator.sizeCol = this.translate(operator.sizeCol, ctx, 1);
  }
}
