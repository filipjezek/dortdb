import {
  ASTIdentifier,
  PlanOperator,
  VariableMapper,
  VariableMapperCtx,
} from '@dortdb/core';
import { ProjectionSize, TreeJoin, XQueryPlanVisitor } from '../plan/index.js';
import { Trie } from '@dortdb/core/data-structures';
import { DOT, LEN, POS } from '../utils/dot.js';

export class XQueryVariableMapper
  extends VariableMapper
  implements XQueryPlanVisitor<void, VariableMapperCtx>
{
  override mapVariables(plan: PlanOperator): VariableMapperCtx {
    const ctx: VariableMapperCtx = {
      scopeStack: [new Trie()],
      currentIndex: 0,
      variableNames: [],
      translations: new Map(),
    };
    for (const attr of [DOT, POS, LEN]) {
      ctx.scopeStack[0].set(
        attr.parts,
        ASTIdentifier.fromParts([ctx.currentIndex]),
      );
      ctx.variableNames[ctx.currentIndex++] = attr;
    }
    plan.accept(this.vmap, ctx);
    return ctx;
  }
  visitTreeJoin(operator: TreeJoin, ctx: VariableMapperCtx): void {
    operator.source.accept(this.vmap, ctx);
    operator.step.accept(this.vmap, ctx);
    ctx.currentIndex -= ctx.scopeStack.pop().size;
  }
  visitProjectionSize(operator: ProjectionSize, ctx: VariableMapperCtx): void {
    operator.source.accept(this.vmap, ctx);
    operator.sizeCol = this.translate(operator.sizeCol, ctx, 1);
  }
}
