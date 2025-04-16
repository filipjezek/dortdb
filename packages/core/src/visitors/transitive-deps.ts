import {
  IdSet,
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../plan/visitor.js';
import * as plan from '../plan/operators/index.js';
import { union } from '../utils/trie.js';
import { isCalc, isId, retI0 } from '../internal-fns/index.js';
import { allAttrs, ASTIdentifier } from '../ast.js';
import { Trie } from '../data-structures/trie.js';

let tdepsCache = new WeakMap<LogicalPlanOperator, IdSet>();

export class TransitiveDependencies implements LogicalPlanVisitor<IdSet> {
  constructor(protected vmap: Record<string, LogicalPlanVisitor<IdSet>>) {
    this.processNode = this.processNode.bind(this);
  }

  public get(op: LogicalPlanOperator) {
    return op.accept(this.vmap);
  }

  protected onlyExternal(deps: IdSet, op: LogicalPlanTupleOperator) {
    for (const id of op.schema) {
      deps.delete(id.parts);
    }
    return deps;
  }
  protected processNode(node: LogicalPlanOperator) {
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
    return union(horizontal, operator.source.accept(this.vmap));
  }
  visitProjection(operator: plan.Projection): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal = this.onlyExternal(
      union(
        ...operator.attrs.map(retI0).filter(isCalc).map(this.processNode),
        operator.dependencies,
      ),
      operator,
    );
    return union(horizontal, operator.source.accept(this.vmap));
  }
  visitSelection(operator: plan.Selection): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal = this.onlyExternal(
      operator.condition instanceof ASTIdentifier
        ? new Trie([operator.condition.parts])
        : this.visitCalculation(operator.condition),
      operator,
    );
    return union(horizontal, operator.source.accept(this.vmap));
  }
  visitTupleSource(operator: plan.TupleSource): IdSet {
    return operator.dependencies;
  }
  visitItemSource(operator: plan.ItemSource): IdSet {
    return operator.dependencies;
  }
  visitFnCall(operator: plan.FnCall): IdSet {
    return operator.dependencies;
  }
  visitLiteral(operator: plan.Literal): IdSet {
    return operator.dependencies;
  }
  visitCalculation(operator: plan.Calculation): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    return union(
      ...(operator.args.filter((x) => !isId(x)) as LogicalPlanOperator[]).map(
        this.processNode,
      ),
      operator.dependencies,
    );
  }
  visitConditional(operator: plan.Conditional): IdSet {
    return operator.dependencies;
  }
  visitCartesianProduct(operator: plan.CartesianProduct): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    return union(
      operator.left.accept(this.vmap),
      operator.right.accept(this.vmap),
    );
  }
  visitJoin(operator: plan.Join): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal = this.onlyExternal(
      operator.on.accept(this.vmap),
      operator,
    );
    return union(
      horizontal,
      operator.left.accept(this.vmap),
      operator.right.accept(this.vmap),
    );
  }
  visitProjectionConcat(operator: plan.ProjectionConcat): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal = this.onlyExternal(
      operator.mapping.accept(this.vmap),
      operator,
    );
    return union(horizontal, operator.source.accept(this.vmap));
  }
  visitMapToItem(operator: plan.MapToItem): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    return operator.source.accept(this.vmap);
  }
  visitMapFromItem(operator: plan.MapFromItem): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    return operator.source.accept(this.vmap);
  }
  visitProjectionIndex(operator: plan.ProjectionIndex): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    return operator.source.accept(this.vmap);
  }
  visitOrderBy(operator: plan.OrderBy): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    const horizontal = this.onlyExternal(
      union(
        ...operator.orders
          .map((x) => x.key)
          .filter(isCalc)
          .map(this.processNode),
        operator.dependencies,
      ),
      operator,
    );
    return union(horizontal, operator.source.accept(this.vmap));
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
    return union(horizontal, operator.source.accept(this.vmap));
  }
  visitLimit(operator: plan.Limit): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    return operator.source.accept(this.vmap);
  }
  private visitSetOp(operator: plan.SetOperator) {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    return union(
      operator.left.accept(this.vmap),
      operator.right.accept(this.vmap),
    );
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
    return union(horizontal, operator.source.accept(this.vmap));
  }
  visitNullSource(operator: plan.NullSource): IdSet {
    return operator.dependencies;
  }
  visitAggregate(operator: plan.AggregateCall): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    return union(
      ...operator.args.filter(isCalc).map(this.processNode),
      operator.dependencies,
    );
  }
  visitItemFnSource(operator: plan.ItemFnSource): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    return union(
      ...operator.args.filter(isCalc).map(this.processNode),
      operator.dependencies,
    );
  }
  visitTupleFnSource(operator: plan.TupleFnSource): IdSet {
    if (tdepsCache.has(operator)) return tdepsCache.get(operator);
    return union(
      ...operator.args.filter(isCalc).map(this.processNode),
      operator.dependencies,
    );
  }
  visitQuantifier(operator: plan.Quantifier): IdSet {
    return operator.dependencies;
  }
  public invalidateCache(changed: LogicalPlanOperator) {
    tdepsCache = new WeakMap();
  }
}
