import { ASTIdentifier } from '../ast.js';
import * as operators from './operators/index.js';
import { Trie } from '../data-structures/trie.js';

export interface PlanOperator {
  lang: Lowercase<string>;
  parent?: PlanOperator;
  dependencies: IdSet;

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret;
  replaceChild(current: PlanOperator, replacement: PlanOperator): void;
  getChildren(): PlanOperator[];
}
export abstract class PlanTupleOperator implements PlanOperator {
  public schema: ASTIdentifier[];
  public schemaSet: IdSet;
  public lang: Lowercase<string>;
  public parent?: PlanOperator;
  public dependencies = new Trie<string | symbol>();

  abstract accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret;
  abstract replaceChild(current: PlanOperator, replacement: PlanOperator): void;
  abstract getChildren(): PlanOperator[];

  /** will preserve object references */
  public addToSchema(item: ASTIdentifier | ASTIdentifier[] | IdSet) {
    if (Array.isArray(item)) {
      for (const i of item) {
        if (!this.schemaSet.has(i.parts)) {
          this.schema.push(i);
          this.schemaSet.add(i.parts);
        }
      }
    } else if (item instanceof Trie) {
      for (const i of item) {
        if (!this.schemaSet.has(i)) {
          this.schema.push(ASTIdentifier.fromParts(i));
          this.schemaSet.add(i);
        }
      }
    } else {
      if (!this.schemaSet.has(item.parts)) {
        this.schema.push(item);
        this.schemaSet.add(item.parts);
      }
    }
  }
  /** will preserve object references */
  public removeFromSchema(item: ASTIdentifier | ASTIdentifier[] | IdSet) {
    let removed = false;
    if (Array.isArray(item)) {
      for (const i of item) {
        removed = this.schemaSet.delete(i.parts) || removed;
      }
    } else if (item instanceof Trie) {
      for (const i of item) {
        removed = this.schemaSet.delete(i) || removed;
      }
    } else {
      removed = this.schemaSet.delete(item.parts);
    }

    if (removed) {
      const ordered = this.schema.filter((s) => this.schemaSet.has(s.parts));
      this.schema.length = 0;
      this.schema.push(...ordered);
    }
    return removed;
  }
  /** will preserve object references */
  public clearSchema() {
    // https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-arraysetlength
    // in other words, this will remove all elements from the array
    this.schema.length = 0;
    this.schemaSet.clear();
  }
}

export type OpOrId = PlanOperator | ASTIdentifier;

export type Aliased<T = ASTIdentifier> = [T, ASTIdentifier];

export type IdSet = Trie<string | symbol, any>;

export interface PlanVisitor<Ret, Arg = never> {
  visitRecursion(operator: operators.Recursion, arg?: Arg): Ret;
  visitProjection(operator: operators.Projection, arg?: Arg): Ret;
  visitSelection(operator: operators.Selection, arg?: Arg): Ret;
  visitTupleSource(operator: operators.TupleSource, arg?: Arg): Ret;
  visitItemSource(operator: operators.ItemSource, arg?: Arg): Ret;
  visitFnCall(operator: operators.FnCall, arg?: Arg): Ret;
  visitLiteral(operator: operators.Literal, arg?: Arg): Ret;
  visitCalculation(operator: operators.Calculation, arg?: Arg): Ret;
  visitConditional(operator: operators.Conditional, arg?: Arg): Ret;
  visitCartesianProduct(operator: operators.CartesianProduct, arg?: Arg): Ret;
  visitJoin(operator: operators.Join, arg?: Arg): Ret;
  visitProjectionConcat(operator: operators.ProjectionConcat, arg?: Arg): Ret;
  visitMapToItem(operator: operators.MapToItem, arg?: Arg): Ret;
  visitMapFromItem(operator: operators.MapFromItem, arg?: Arg): Ret;
  visitProjectionIndex(operator: operators.ProjectionIndex, arg?: Arg): Ret;
  visitOrderBy(operator: operators.OrderBy, arg?: Arg): Ret;
  visitGroupBy(operator: operators.GroupBy, arg?: Arg): Ret;
  visitLimit(operator: operators.Limit, arg?: Arg): Ret;
  visitUnion(operator: operators.Union, arg?: Arg): Ret;
  visitIntersection(operator: operators.Intersection, arg?: Arg): Ret;
  visitDifference(operator: operators.Difference, arg?: Arg): Ret;
  visitDistinct(operator: operators.Distinct, arg?: Arg): Ret;
  visitNullSource(operator: operators.NullSource, arg?: Arg): Ret;
  visitAggregate(operator: operators.AggregateCall, arg?: Arg): Ret;
  visitItemFnSource(operator: operators.ItemFnSource, arg?: Arg): Ret;
  visitTupleFnSource(operator: operators.TupleFnSource, arg?: Arg): Ret;
  visitQuantifier(operator: operators.Quantifier, arg?: Arg): Ret;
}
