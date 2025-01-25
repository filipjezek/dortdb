import { ASTIdentifier } from '../ast.js';
import * as operators from './operators/index.js';
import { Trie } from 'mnemonist';

export interface LogicalPlanOperator {
  lang: string;

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T;
}
export abstract class LogicalPlanTupleOperator implements LogicalPlanOperator {
  public schema: ASTIdentifier[];
  public schemaSet: Trie<(string | symbol)[]>;
  public lang: string;

  abstract accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T;
  /** will preserve object references */
  public addToSchema(
    item: ASTIdentifier | ASTIdentifier[] | Trie<(string | symbol)[]>
  ) {
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
  public removeFromSchema(
    item: ASTIdentifier | ASTIdentifier[] | Trie<(string | symbol)[]>
  ) {
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

export type LogicalOpOrId = LogicalPlanOperator | ASTIdentifier;

export type Aliased<T = ASTIdentifier> = [T, ASTIdentifier];

export interface LogicalPlanVisitor<T> {
  visitProjection(operator: operators.Projection): T;
  visitSelection(operator: operators.Selection): T;
  visitTupleSource(operator: operators.TupleSource): T;
  visitItemSource(operator: operators.ItemSource): T;
  visitFnCall(operator: operators.FnCall): T;
  visitLiteral(operator: operators.Literal): T;
  visitCalculation(operator: operators.Calculation): T;
  visitConditional(operator: operators.Conditional): T;
  visitCartesianProduct(operator: operators.CartesianProduct): T;
  visitJoin(operator: operators.Join): T;
  visitProjectionConcat(operator: operators.ProjectionConcat): T;
  visitMapToItem(operator: operators.MapToItem): T;
  visitMapFromItem(operator: operators.MapFromItem): T;
  visitProjectionIndex(operator: operators.ProjectionIndex): T;
  visitOrderBy(operator: operators.OrderBy): T;
  visitGroupBy(operator: operators.GroupBy): T;
  visitLimit(operator: operators.Limit): T;
  visitUnion(operator: operators.Union): T;
  visitIntersection(operator: operators.Intersection): T;
  visitDifference(operator: operators.Difference): T;
  visitDistinct(operator: operators.Distinct): T;
  visitNullSource(operator: operators.NullSource): T;
  visitAggregate(operator: operators.AggregateCall): T;
  visitItemFnSource(operator: operators.ItemFnSource): T;
  visitTupleFnSource(operator: operators.TupleFnSource): T;
  visitQuantifier(operator: operators.Quantifier): T;
}
