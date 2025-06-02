import { VariableMapper, VariableMapperCtx } from '@dortdb/core';
import { ProjectionSize, TreeJoin, XQueryPlanVisitor } from '../plan/index.js';
import { DOT, LEN, POS } from '../utils/dot.js';

export class XQueryVariableMapper
  extends VariableMapper
  implements XQueryPlanVisitor<void, VariableMapperCtx>
{
  visitTreeJoin(operator: TreeJoin, ctx: VariableMapperCtx): void {
    operator.source.accept(this.vmap, ctx);
    const scope = ctx.scopeStack.at(-1);
    ctx.translations.set(operator, scope);
    scope.set(DOT.parts, this.translate(DOT, ctx));
    scope.set(POS.parts, this.translate(POS, ctx));
    scope.set(LEN.parts, this.translate(LEN, ctx));
    operator.step.accept(this.vmap, ctx);
  }
  visitProjectionSize(operator: ProjectionSize, ctx: VariableMapperCtx): void {
    operator.source.accept(this.vmap, ctx);
    this.setTranslations(operator, ctx);
    operator.sizeCol = this.translate(operator.sizeCol, ctx, 1);
  }
}
