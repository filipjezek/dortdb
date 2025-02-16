import {
  Projection,
  Selection,
  TupleSource,
  ItemSource,
  FnCall,
  Literal,
  Calculation,
  Conditional,
  CartesianProduct,
  Join,
  ProjectionConcat,
  MapToItem,
  MapFromItem,
  ProjectionIndex,
  OrderBy,
  GroupBy,
  Limit,
  Union,
  Intersection,
  Difference,
  Distinct,
  NullSource,
  AggregateCall,
  ItemFnSource,
  TupleFnSource,
  Quantifier,
} from '@dortdb/core/plan';
import {
  ProjectionSize,
  TreeJoin,
  XQueryLogicalPlanVisitor,
} from 'src/plan/index.js';
import { Trie } from 'mnemonist';
import {
  ASTIdentifier,
  IdSet,
  LogicalOpOrId,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '@dortdb/core';
import { unwind } from '@dortdb/core/fns';

function union(a: IdSet, b: IdSet): IdSet {
  const result = new Trie<(string | symbol)[]>(Array);
  for (const id of a) {
    result.add(id);
  }
  for (const id of b) {
    result.add(id);
  }
  return result;
}

export class ItemSourceResolver
  implements XQueryLogicalPlanVisitor<void, IdSet>
{
  constructor(private vmap: Record<string, LogicalPlanVisitor<void, IdSet>>) {}

  public resolveItemSources(operator: LogicalPlanOperator) {
    operator.accept(this.vmap, new Trie<(string | symbol)[]>(Array));
  }

  private processAttr(attr: LogicalOpOrId, known: IdSet) {
    if (!(attr instanceof ASTIdentifier)) {
      this.descend(attr, known);
    }
  }
  private descend(operator: LogicalPlanOperator, known: IdSet) {
    if (operator.lang === 'xquery') {
      operator.accept(this.vmap, known);
    }
  }

  visitTreeJoin(operator: TreeJoin, known: IdSet): void {
    this.descend(operator.source, known);
    this.descend(operator.step, union(known, operator.source.schemaSet));
  }
  visitProjectionSize(operator: ProjectionSize, known: IdSet): void {
    this.descend(operator.source, known);
  }
  visitProjection(operator: Projection, known: IdSet): void {
    this.descend(operator.source, known);
    known = union(known, operator.source.schemaSet);
    for (const attr of operator.attrs) {
      this.processAttr(attr[0], known);
    }
  }
  visitSelection(operator: Selection, known: IdSet): void {
    this.descend(operator.source, known);
    known = union(known, operator.schemaSet);
    this.processAttr(operator.condition, known);
  }
  visitTupleSource(operator: TupleSource, known: IdSet): void {
    return;
  }
  visitItemSource(operator: ItemSource, known: IdSet): void {
    const srcName = Array.isArray(operator.name)
      ? operator.name[0]
      : operator.name;
    if (known.has(srcName.parts)) {
      operator.parent.replaceChild(
        operator,
        new ItemFnSource('xquery', [srcName], unwind.impl),
      );
    }
  }
  visitFnCall(operator: FnCall, known: IdSet): void {
    throw new Error('Method not implemented.');
  }
  visitLiteral(operator: Literal, known: IdSet): void {
    throw new Error('Method not implemented.');
  }
  visitCalculation(operator: Calculation, known: IdSet): void {
    for (const arg of operator.args) {
      this.processAttr(arg, known);
    }
  }
  visitConditional(operator: Conditional, known: IdSet): void {
    throw new Error('Method not implemented.');
  }
  visitCartesianProduct(operator: CartesianProduct, known: IdSet): void {
    this.descend(operator.left, known);
    this.descend(operator.right, known);
  }
  visitJoin(operator: Join, known: IdSet): void {
    this.visitCartesianProduct(operator, known);
    if (operator.on) {
      this.descend(operator.on, union(known, operator.schemaSet));
    }
  }
  visitProjectionConcat(operator: ProjectionConcat, known: IdSet): void {
    this.descend(operator.source, known);
    this.descend(operator.mapping, union(known, operator.source.schemaSet));
  }
  visitMapToItem(operator: MapToItem, known: IdSet): void {
    this.descend(operator.source, known);
  }
  visitMapFromItem(operator: MapFromItem, known: IdSet): void {
    this.descend(operator.source, known);
  }
  visitProjectionIndex(operator: ProjectionIndex, known: IdSet): void {
    this.descend(operator.source, known);
  }
  visitOrderBy(operator: OrderBy, known: IdSet): void {
    this.descend(operator.source, known);
    known = union(known, operator.schemaSet);
    for (const arg of operator.orders) {
      this.processAttr(arg.key, known);
    }
  }
  visitGroupBy(operator: GroupBy, known: IdSet): void {
    this.descend(operator.source, known);
    for (const agg of operator.aggs) {
      this.descend(agg.postGroupOp, known);
    }
    known = union(known, operator.source.schemaSet);
    for (const arg of operator.keys) {
      this.processAttr(arg[0], known);
    }
  }
  visitLimit(operator: Limit, known: IdSet): void {
    this.descend(operator.source, known);
  }
  visitUnion(operator: Union, known: IdSet): void {
    this.descend(operator.left, known);
    this.descend(operator.right, known);
  }
  visitIntersection(operator: Intersection, known: IdSet): void {
    this.descend(operator.left, known);
    this.descend(operator.right, known);
  }
  visitDifference(operator: Difference, known: IdSet): void {
    this.descend(operator.left, known);
    this.descend(operator.right, known);
  }
  visitDistinct(operator: Distinct, known: IdSet): void {
    this.descend(operator.source, known);
    if (Array.isArray(operator.attrs)) {
      known = union(known, operator.schemaSet);
      for (const attr of operator.attrs) {
        this.processAttr(attr, known);
      }
    }
  }
  visitNullSource(operator: NullSource, known: IdSet): void {
    return;
  }
  visitAggregate(operator: AggregateCall, known: IdSet): void {
    throw new Error('Method not implemented.');
  }
  visitItemFnSource(operator: ItemFnSource, known: IdSet): void {
    for (const arg of operator.args) {
      this.processAttr(arg, known);
    }
  }
  visitTupleFnSource(operator: TupleFnSource, known: IdSet): void {
    for (const arg of operator.args) {
      this.processAttr(arg, known);
    }
  }
  visitQuantifier(operator: Quantifier, known: IdSet): void {
    throw new Error('Method not implemented.');
  }
}
