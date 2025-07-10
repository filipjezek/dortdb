import { Trie } from '../data-structures/trie.js';
import {
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../plan/visitor.js';
import * as plan from '../plan/operators/index.js';
import { allAttrs, ASTIdentifier, boundParam } from '../ast.js';

export type VariableMap = Trie<string | number | symbol, ASTIdentifier>;
export interface VariableMapperCtx {
  scopeStack: VariableMap[];
  translations: Map<PlanOperator, VariableMap>;
  variableNames: ASTIdentifier[];
  currentIndex: number;
}

export class VariableMapper implements PlanVisitor<void, VariableMapperCtx> {
  constructor(
    protected vmap: Record<string, PlanVisitor<void, VariableMapperCtx>>,
  ) {}

  public mapVariables(plan: PlanOperator): VariableMapperCtx {
    const ctx: VariableMapperCtx = {
      scopeStack: [
        new Trie(), // for bound params
      ],
      currentIndex: 0,
      variableNames: [],
      translations: new Map(),
    };
    plan.accept(this.vmap, ctx);
    return ctx;
  }

  protected translate(
    attr: ASTIdentifier,
    ctx: VariableMapperCtx,
    depth = ctx.scopeStack.length,
  ): ASTIdentifier {
    const isBoundParam = attr.parts[0] === boundParam;
    for (
      let i = isBoundParam ? 0 : ctx.scopeStack.length - 1;
      i >= ctx.scopeStack.length - depth;
      i--
    ) {
      const scope = ctx.scopeStack[i];
      const translated = scope.get(attr.parts);
      if (translated !== undefined) {
        return translated;
      }
    }
    const newTranslation = ASTIdentifier.fromParts([ctx.currentIndex]);
    ctx.scopeStack.at(isBoundParam ? 0 : -1).set(attr.parts, newTranslation);
    ctx.variableNames[ctx.currentIndex++] = attr;
    return newTranslation;
  }

  protected union(a: VariableMap, b: VariableMap): VariableMap {
    const result: VariableMap = new Trie();
    for (const [key, value] of a.entries()) {
      result.set(key, value);
    }
    for (const [key, value] of b.entries()) {
      result.set(key, value);
    }
    return result;
  }

  protected setTranslations(operator: PlanOperator, ctx: VariableMapperCtx) {
    const scope = ctx.scopeStack.at(-1);
    ctx.translations.set(operator, scope);
  }

  visitRecursion(operator: plan.Recursion, ctx: VariableMapperCtx): void {
    operator.source.accept(this.vmap, ctx);
    this.setTranslations(operator, ctx);
    this.visitCalculation(operator.condition, ctx);
  }
  visitProjection(operator: plan.Projection, ctx: VariableMapperCtx): void {
    operator.source.accept(this.vmap, ctx);
    this.setTranslations(operator, ctx);
    for (const attr of operator.attrs) {
      const tgtTranslated = this.translate(attr[1], ctx, 1);
      if (attr[0] instanceof ASTIdentifier) {
        const srcTranslated = this.translate(attr[0], ctx);
        operator.renames.delete(attr[0].parts);
        operator.renames.set(srcTranslated.parts, tgtTranslated.parts);
        operator.renamesInv.delete(attr[1].parts);
        operator.renamesInv.set(tgtTranslated.parts, srcTranslated.parts);
        attr[0] = srcTranslated;
      } else {
        this.visitCalculation(attr[0], ctx);
      }
      attr[1] = tgtTranslated;
    }
  }
  visitSelection(operator: plan.Selection, ctx: VariableMapperCtx): void {
    operator.source.accept(this.vmap, ctx);
    this.setTranslations(operator, ctx);
    this.visitCalculation(operator.condition, ctx);
  }
  visitTupleSource(operator: plan.TupleSource, ctx: VariableMapperCtx): void {
    const scope: VariableMap = new Trie();
    ctx.scopeStack.push(scope);
    ctx.translations.set(operator, scope);

    for (const attr of operator.schema) {
      ctx.variableNames[ctx.currentIndex] = attr;
      scope.set(attr.parts, ASTIdentifier.fromParts([ctx.currentIndex++]));
    }
  }
  visitItemSource(operator: plan.ItemSource, ctx: VariableMapperCtx): void {}
  visitFnCall(operator: plan.FnCall, ctx: VariableMapperCtx): void {
    throw new Error('Method not implemented.');
  }
  visitLiteral(operator: plan.Literal, ctx: VariableMapperCtx): void {
    throw new Error('Method not implemented.');
  }
  visitCalculation(operator: plan.Calculation, ctx: VariableMapperCtx): void {
    for (let i = 0; i < operator.args.length; i++) {
      const arg = operator.args[i];
      if (arg instanceof ASTIdentifier) {
        operator.args[i] = this.translate(arg, ctx);
      } else {
        arg.accept(this.vmap, ctx);
      }
    }
  }
  visitConditional(operator: plan.Conditional, ctx: VariableMapperCtx): void {
    throw new Error('Method not implemented.');
  }
  visitCartesianProduct(
    operator: plan.CartesianProduct,
    ctx: VariableMapperCtx,
  ): void {
    operator.left.accept(this.vmap, ctx);
    const left = ctx.scopeStack.pop();
    operator.right.accept(this.vmap, ctx);
    const right = ctx.scopeStack.pop();
    const sum = this.union(right, left);
    ctx.scopeStack.push(sum);
    ctx.translations.set(operator, sum);
    ctx.currentIndex =
      Math.max(...Array.from(sum.entries(), (x) => x[1].parts[0] as number)) +
      1;
  }
  visitJoin(operator: plan.Join, ctx: VariableMapperCtx): void {
    this.visitCartesianProduct(operator, ctx);
    for (const condition of operator.conditions) {
      this.visitCalculation(condition, ctx);
    }
  }
  visitProjectionConcat(
    operator: plan.ProjectionConcat,
    ctx: VariableMapperCtx,
  ): void {
    operator.source.accept(this.vmap, ctx);
    operator.mapping.accept(this.vmap, ctx);
    const mapping = ctx.scopeStack.pop();
    const source = ctx.scopeStack.pop();
    const sum = this.union(mapping, source);
    if (operator.outer) {
      const originalEmpty = operator.emptyVal;
      operator.emptyVal = new Trie();
      for (const [key, value] of originalEmpty.entries()) {
        operator.emptyVal.set(ctx.scopeStack.at(-1).get(key).parts, value);
      }
    }
    ctx.scopeStack.push(sum);
    ctx.translations.set(operator, sum);
    ctx.currentIndex =
      Math.max(...Array.from(sum.entries(), (x) => x[1].parts[0] as number)) +
      1;
  }
  visitMapToItem(operator: plan.MapToItem, ctx: VariableMapperCtx): void {
    operator.source.accept(this.vmap, ctx);
    this.setTranslations(operator, ctx);
    operator.key = this.translate(operator.key, ctx);
    ctx.currentIndex -= ctx.scopeStack.pop().size;
  }
  visitMapFromItem(operator: plan.MapFromItem, ctx: VariableMapperCtx): void {
    operator.source.accept(this.vmap, ctx);
    ctx.scopeStack.push(new Trie());
    this.setTranslations(operator, ctx);
    operator.key = this.translate(operator.key, ctx, 1);
  }
  visitProjectionIndex(
    operator: plan.ProjectionIndex,
    ctx: VariableMapperCtx,
  ): void {
    operator.source.accept(this.vmap, ctx);
    this.setTranslations(operator, ctx);
    operator.indexCol = this.translate(operator.indexCol, ctx, 1);
  }
  visitOrderBy(operator: plan.OrderBy, ctx: VariableMapperCtx): void {
    operator.source.accept(this.vmap, ctx);
    this.setTranslations(operator, ctx);
    for (const order of operator.orders) {
      if (order.key instanceof ASTIdentifier) {
        order.key = this.translate(order.key, ctx);
      } else {
        this.visitCalculation(order.key, ctx);
      }
    }
  }
  visitGroupBy(operator: plan.GroupBy, ctx: VariableMapperCtx): void {
    operator.source.accept(this.vmap, ctx);
    this.setTranslations(operator, ctx);
    for (const key of operator.keys) {
      key[1] = this.translate(key[1], ctx, 1);
      if (key[0] instanceof ASTIdentifier) {
        key[0] = this.translate(key[0], ctx);
      } else {
        this.visitCalculation(key[0], ctx);
      }
    }
    for (const agg of operator.aggs) {
      this.visitAggregate(agg, ctx);
    }
  }
  visitLimit(operator: plan.Limit, ctx: VariableMapperCtx): void {
    operator.source.accept(this.vmap, ctx);
    this.setTranslations(operator, ctx);
  }
  protected visitSetOp(
    operator: plan.SetOperator,
    ctx: VariableMapperCtx,
  ): void {
    operator.left.accept(this.vmap, ctx);
    this.setTranslations(operator, ctx);
    operator.right.accept(this.vmap, ctx);
    if (operator.right instanceof PlanTupleOperator && operator.right.schema)
      ctx.currentIndex -= ctx.scopeStack.pop().size;
  }
  visitUnion(operator: plan.Union, ctx: VariableMapperCtx): void {
    this.visitSetOp(operator, ctx);
  }
  visitIntersection(operator: plan.Intersection, ctx: VariableMapperCtx): void {
    this.visitSetOp(operator, ctx);
  }
  visitDifference(operator: plan.Difference, ctx: VariableMapperCtx): void {
    this.visitSetOp(operator, ctx);
  }
  visitDistinct(operator: plan.Distinct, ctx: VariableMapperCtx): void {
    operator.source.accept(this.vmap, ctx);
    this.setTranslations(operator, ctx);
    if (operator.attrs !== allAttrs) {
      for (let i = 0; i < operator.attrs.length; i++) {
        const attr = operator.attrs[i];
        if (attr instanceof ASTIdentifier) {
          operator.attrs[i] = this.translate(attr, ctx);
        } else {
          this.visitCalculation(attr, ctx);
        }
      }
    }
  }
  visitNullSource(operator: plan.NullSource, ctx: VariableMapperCtx): void {
    ctx.scopeStack.push(new Trie());
    this.setTranslations(operator, ctx);
  }
  visitAggregate(operator: plan.AggregateCall, ctx: VariableMapperCtx): void {
    this.setTranslations(operator, ctx);
    operator.fieldName = this.translate(operator.fieldName, ctx, 1);
    operator.postGroupOp.accept(this.vmap, ctx);
    for (let i = 0; i < operator.args.length; i++) {
      const arg = operator.args[i];
      if (arg instanceof ASTIdentifier) {
        operator.args[i] = this.translate(arg, ctx);
      } else {
        this.visitCalculation(arg, ctx);
      }
    }
    ctx.currentIndex -= ctx.scopeStack.pop().size;
  }
  visitItemFnSource(operator: plan.ItemFnSource, ctx: VariableMapperCtx): void {
    for (let i = 0; i < operator.args.length; i++) {
      const arg = operator.args[i];
      if (arg instanceof ASTIdentifier) {
        operator.args[i] = this.translate(arg, ctx);
      } else {
        this.visitCalculation(arg, ctx);
      }
    }
  }
  visitTupleFnSource(
    operator: plan.TupleFnSource,
    ctx: VariableMapperCtx,
  ): void {
    const scope: VariableMap = new Trie();
    ctx.translations.set(operator, scope);
    ctx.scopeStack.push(scope);
    for (let i = 0; i < operator.args.length; i++) {
      const arg = operator.args[i];
      if (arg instanceof ASTIdentifier) {
        operator.args[i] = this.translate(arg, ctx);
      } else {
        this.visitCalculation(arg, ctx);
      }
    }
    for (const attr of operator.schema) {
      ctx.variableNames[ctx.currentIndex] = attr;
      scope.set(attr.parts, ASTIdentifier.fromParts([ctx.currentIndex++]));
    }
  }
  visitQuantifier(operator: plan.Quantifier, ctx: VariableMapperCtx): void {
    throw new Error('Method not implemented.');
  }
  visitIndexScan(operator: plan.IndexScan, ctx: VariableMapperCtx): void {
    this.visitTupleSource(operator, ctx);
    if (operator.fromItemKey) {
      operator.fromItemKey = this.translate(operator.fromItemKey, ctx, 1);
    }
    this.visitCalculation(operator.access, ctx);
  }
  visitIndexedRecursion(
    operator: plan.IndexedRecursion,
    ctx: VariableMapperCtx,
  ): void {
    operator.source.accept(this.vmap, ctx);
    this.setTranslations(operator, ctx);
    operator.mapping.accept(this.vmap, ctx);
    ctx.currentIndex -= ctx.scopeStack.pop().size;
  }
}
