import {
  IdSet,
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../plan/visitor.js';
import * as plan from '../plan/operators/index.js';
import { union } from '../utils/trie.js';
import { isCalc, isId, retI0 } from '../internal-fns/index.js';
import { allAttrs } from '../ast.js';

let tdepsCache = new WeakMap<PlanOperator, IdSet>();

export class TransitiveDependencies implements PlanVisitor<IdSet> {
  constructor(protected vmap: Record<string, PlanVisitor<IdSet>>) {
    this.processNode = this.processNode.bind(this);
  }

  protected onlyExternal(deps: IdSet, op: PlanTupleOperator) {
    const clone = deps.clone();
    for (const id of op.schema) {
      clone.delete(id.parts);
    }
    return clone;
  }
  protected processNode(node: PlanOperator) {
    return node.accept(this.vmap);
  }
  protected getCache() {
    return tdepsCache;
  }

  visitRecursion(operator: plan.Recursion): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal = this.onlyExternal(
      this.visitCalculation(operator.condition),
      operator,
    );
    const result = union(horizontal, operator.source.accept(this.vmap));
    tdepsCache.set(operator, result);
    return result;
  }
  visitProjection(operator: plan.Projection): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal = this.onlyExternal(
      union(
        ...operator.attrs.map(retI0).filter(isCalc).map(this.processNode),
        operator.dependencies,
      ),
      operator.source,
    );
    const result = union(horizontal, operator.source.accept(this.vmap));
    tdepsCache.set(operator, result);
    return result;
  }
  visitSelection(operator: plan.Selection): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal = this.onlyExternal(
      this.visitCalculation(operator.condition),
      operator,
    );
    const result = union(horizontal, operator.source.accept(this.vmap));
    tdepsCache.set(operator, result);
    return result;
  }
  visitTupleSource(operator: plan.TupleSource): IdSet {
    return operator.dependencies;
  }
  visitItemSource(operator: plan.ItemSource): IdSet {
    return operator.dependencies;
  }
  visitFnCall(operator: plan.FnCall): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const result = union(
      ...operator.args
        .filter((arg) => 'op' in arg)
        .map((arg) => this.processNode(arg.op)),
      operator.dependencies,
    );
    tdepsCache.set(operator, result);
    return result;
  }
  visitLiteral(operator: plan.Literal): IdSet {
    return operator.dependencies;
  }
  visitCalculation(operator: plan.Calculation): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const result = union(
      ...(operator.args.filter((x) => !isId(x)) as PlanOperator[]).map(
        this.processNode,
      ),
      operator.dependencies,
    );
    tdepsCache.set(operator, result);
    return result;
  }
  visitConditional(operator: plan.Conditional): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const result = union(
      ...operator.getChildren().map(this.processNode),
      operator.dependencies,
    );
    tdepsCache.set(operator, result);
    return result;
  }
  visitCartesianProduct(operator: plan.CartesianProduct): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const result = union(
      operator.left.accept(this.vmap),
      operator.right.accept(this.vmap),
    );
    tdepsCache.set(operator, result);
    return result;
  }
  visitJoin(operator: plan.Join): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal = this.onlyExternal(
      union(...operator.conditions.map(this.processNode)),
      operator,
    );
    const result = union(
      horizontal,
      operator.left.accept(this.vmap),
      operator.right.accept(this.vmap),
    );
    tdepsCache.set(operator, result);
    return result;
  }
  visitProjectionConcat(operator: plan.ProjectionConcat): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal = this.onlyExternal(
      operator.mapping.accept(this.vmap),
      operator,
    );
    const result = union(horizontal, operator.source.accept(this.vmap));
    tdepsCache.set(operator, result);
    return result;
  }
  visitMapToItem(operator: plan.MapToItem): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const result = operator.source.accept(this.vmap);
    tdepsCache.set(operator, result);
    return result;
  }
  visitMapFromItem(operator: plan.MapFromItem): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const result = operator.source.accept(this.vmap);
    tdepsCache.set(operator, result);
    return result;
  }
  visitProjectionIndex(operator: plan.ProjectionIndex): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const result = operator.source.accept(this.vmap);
    tdepsCache.set(operator, result);
    return result;
  }
  visitOrderBy(operator: plan.OrderBy): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal = this.onlyExternal(
      union(
        ...operator.orders
          .map(plan.getKey)
          .filter(isCalc)
          .map(this.processNode),
        operator.dependencies,
      ),
      operator,
    );
    const result = union(horizontal, operator.source.accept(this.vmap));
    tdepsCache.set(operator, result);
    return result;
  }
  visitGroupBy(operator: plan.GroupBy): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal = this.onlyExternal(
      union(
        ...operator.keys.map(retI0).filter(isCalc).map(this.processNode),
        ...operator.aggs.map(this.processNode),
        operator.dependencies,
      ),
      operator,
    );
    const result = union(horizontal, operator.source.accept(this.vmap));
    tdepsCache.set(operator, result);
    return result;
  }
  visitLimit(operator: plan.Limit): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    return operator.source.accept(this.vmap);
  }
  protected visitSetOp(operator: plan.SetOperator) {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const result = union(
      operator.left.accept(this.vmap),
      operator.right.accept(this.vmap),
    );
    tdepsCache.set(operator, result);
    return result;
  }
  visitUnion(operator: plan.Union): IdSet {
    return this.visitSetOp(operator);
  }
  visitIntersection(operator: plan.Intersection): IdSet {
    return this.visitSetOp(operator);
  }
  visitDifference(operator: plan.Difference): IdSet {
    return this.visitSetOp(operator);
  }
  visitDistinct(operator: plan.Distinct): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal =
      operator.attrs === allAttrs
        ? operator.dependencies
        : this.onlyExternal(
            union(
              ...operator.attrs.filter(isCalc).map(this.processNode),
              operator.dependencies,
            ),
            operator,
          );
    const result = union(horizontal, operator.source.accept(this.vmap));
    tdepsCache.set(operator, result);
    return result;
  }
  visitNullSource(operator: plan.NullSource): IdSet {
    return operator.dependencies;
  }
  visitAggregate(operator: plan.AggregateCall): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const result = union(
      ...operator.args.filter(isCalc).map(this.processNode),
      operator.dependencies,
      operator.postGroupOp.accept(this.vmap),
    );
    tdepsCache.set(operator, result);
    return result;
  }
  visitItemFnSource(operator: plan.ItemFnSource): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const result = union(
      ...operator.args.filter(isCalc).map(this.processNode),
      operator.dependencies,
    );
    tdepsCache.set(operator, result);
    return result;
  }
  visitTupleFnSource(operator: plan.TupleFnSource): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const result = union(
      ...operator.args.filter(isCalc).map(this.processNode),
      operator.dependencies,
    );
    tdepsCache.set(operator, result);
    return result;
  }
  visitQuantifier(operator: plan.Quantifier): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const res = operator.query.accept(this.vmap);
    tdepsCache.set(operator, res);
    return res;
  }
  visitIndexScan(operator: plan.IndexScan): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const res = this.onlyExternal(
      this.visitCalculation(operator.access),
      operator,
    );
    tdepsCache.set(operator, res);
    return res;
  }
  visitIndexedRecursion(operator: plan.IndexedRecursion): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal = this.onlyExternal(
      operator.mapping.accept(this.vmap),
      operator,
    );
    const result = union(horizontal, operator.source.accept(this.vmap));
    tdepsCache.set(operator, result);
    return result;
  }
  public clearCache() {
    tdepsCache = new WeakMap();
  }
  public invalidateCacheDownstream(operator: PlanOperator) {
    while (operator) {
      tdepsCache.delete(operator);
      operator = operator.parent;
    }
  }
  public invalidateCacheUpstream(operator: PlanOperator) {
    tdepsCache.delete(operator);
    for (const child of operator.getChildren()) {
      this.invalidateCacheUpstream(child);
    }
  }
  public invalidateCacheElement(operator: PlanOperator) {
    tdepsCache.delete(operator);
  }
}
