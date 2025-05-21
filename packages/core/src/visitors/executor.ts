import { OpOrId, PlanOperator, PlanVisitor } from '../plan/visitor.js';
import * as plan from '../plan/operators/index.js';
import { ExecutionContext } from '../execution-context.js';
import { DortDBAsFriend } from '../db.js';
import { ASTIdentifier } from '../ast.js';
import { VariableMapperCtx } from './variable-mapper.js';

export class Executor
  implements PlanVisitor<Iterable<unknown>, ExecutionContext>
{
  constructor(
    protected vmap: Record<
      string,
      PlanVisitor<Iterable<unknown>, ExecutionContext>
    >,
    protected db: DortDBAsFriend,
  ) {}

  public execute(
    plan: PlanOperator,
    varMapperCtx: VariableMapperCtx,
  ): { result: Iterable<unknown>; ctx: ExecutionContext } {
    const ctx = new ExecutionContext();
    ctx.translations = varMapperCtx.translations;
    ctx.variableNames = varMapperCtx.variableNames;
    const result = plan.accept(this.vmap, ctx);
    return { result, ctx };
  }

  protected processItem(
    item: ASTIdentifier | plan.Calculation,
    ctx: ExecutionContext,
  ) {
    if (item instanceof ASTIdentifier) {
      return ctx.get(item);
    }
    return this.visitCalculation(item, ctx)[0];
  }

  visitRecursion(
    operator: plan.Recursion,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  *visitProjection(
    operator: plan.Projection,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    for (const item of operator.source.accept(this.vmap, ctx) as Iterable<
      unknown[]
    >) {
      const result: unknown[] = [];
      for (const attr of operator.attrs) {
        result[attr[1].parts[0] as number] = this.processItem(attr[0], ctx);
      }
      for (const attr of operator.attrs) {
        ctx.set(attr[1], result[attr[1].parts[0] as number]);
      }
      yield result;
    }
  }
  *visitSelection(
    operator: plan.Selection,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    for (const item of operator.source.accept(this.vmap, ctx)) {
      const passes = this.visitCalculation(operator.condition, ctx)[0];
      if (passes) yield item;
    }
  }
  visitTupleSource(
    operator: plan.TupleSource,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitItemSource(
    operator: plan.ItemSource,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitFnCall(operator: plan.FnCall, ctx: ExecutionContext): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitLiteral(
    operator: plan.Literal,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitCalculation(
    operator: plan.Calculation,
    ctx: ExecutionContext,
  ): [unknown] {
    return [
      operator.impl(
        ...operator.args.map((arg) =>
          arg instanceof ASTIdentifier
            ? ctx.get(arg)
            : Array.from(arg.accept(this.vmap, ctx)),
        ),
      ),
    ];
  }
  visitConditional(
    operator: plan.Conditional,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitCartesianProduct(
    operator: plan.CartesianProduct,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitJoin(operator: plan.Join, ctx: ExecutionContext): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitProjectionConcat(
    operator: plan.ProjectionConcat,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitMapToItem(
    operator: plan.MapToItem,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitMapFromItem(
    operator: plan.MapFromItem,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitProjectionIndex(
    operator: plan.ProjectionIndex,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitOrderBy(
    operator: plan.OrderBy,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitGroupBy(
    operator: plan.GroupBy,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitLimit(operator: plan.Limit, ctx: ExecutionContext): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitUnion(operator: plan.Union, ctx: ExecutionContext): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitIntersection(
    operator: plan.Intersection,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitDifference(
    operator: plan.Difference,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitDistinct(
    operator: plan.Distinct,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitNullSource(
    operator: plan.NullSource,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    return [null];
  }
  visitAggregate(
    operator: plan.AggregateCall,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitItemFnSource(
    operator: plan.ItemFnSource,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitTupleFnSource(
    operator: plan.TupleFnSource,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitQuantifier(
    operator: plan.Quantifier,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
  visitIndexScan(
    operator: plan.IndexScan,
    ctx: ExecutionContext,
  ): Iterable<unknown> {
    throw new Error('Method not implemented.');
  }
}
