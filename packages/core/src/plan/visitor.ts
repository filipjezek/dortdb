import { ASTIdentifier } from '../ast.js';
import * as operators from './operators/index.js';
import { Trie } from '../data-structures/trie.js';

/** Base interface for every node in the query execution plan tree. */
export interface PlanOperator {
  /** Language tag identifying which {@link PlanVisitor} entry to use for dispatch. */
  lang: Lowercase<string>;
  /** Parent node in the plan tree; `undefined` at the root. */
  parent?: PlanOperator;
  /** Attribute identifiers read by this operator from its input(s). */
  dependencies: IdSet;

  /** Dispatches this operator to the visitor registered under {@link lang}. */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret;
  /**
   * Swaps `current` for `replacement` among this operator's direct children,
   * updating `replacement.parent` to `this`.
   */
  replaceChild(current: PlanOperator, replacement: PlanOperator): void;
  /** Returns all direct child operators of this node. */
  getChildren(): PlanOperator[];
  /** Returns a deep copy of this operator subtree. */
  clone(): PlanOperator;
}

/**
 * Abstract base for operators that produce rows of named attributes (tuple streams).
 *
 * Maintains a parallel {@link schema} array and {@link schemaSet} trie so that
 * attribute membership can be tested in O(k) time (k = identifier depth).
 */
export abstract class PlanTupleOperator implements PlanOperator {
  /** Ordered list of attribute identifiers produced by this operator. */
  public schema: ASTIdentifier[];
  /** Trie-backed set of the same paths as {@link schema}; used for O(k) membership tests. */
  public schemaSet: IdSet;
  /** {@inheritDoc PlanOperator.lang} */
  public lang: Lowercase<string>;
  /** {@inheritDoc PlanOperator.parent} */
  public parent?: PlanOperator;
  /** {@inheritDoc PlanOperator.dependencies} */
  public dependencies = new Trie<string | symbol | number>();

  /** {@inheritDoc PlanOperator.accept} */
  abstract accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret;
  /** {@inheritDoc PlanOperator.replaceChild} */
  abstract replaceChild(current: PlanOperator, replacement: PlanOperator): void;
  /** {@inheritDoc PlanOperator.getChildren} */
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

  /** {@inheritDoc PlanOperator.clone} */
  abstract clone(): PlanTupleOperator;
}

/** A plan operator or a bare attribute identifier; used where either form may appear in a tree position. */
export type OpOrId = PlanOperator | ASTIdentifier;

/** A pair of `[value, alias]`; associates an expression with its output attribute name. */
export type Aliased<T = ASTIdentifier> = [T, ASTIdentifier];

/** Trie-backed set of multi-part identifier paths, keyed by `string | symbol | number` path segments. */
export type IdSet = Trie<string | symbol | number, any>;

/**
 * Visitor interface for the query plan tree.
 *
 * Implement one entry per registered language to traverse or transform the plan.
 * Each {@link PlanOperator} calls the method matching its concrete type via {@link PlanOperator.accept}.
 */
export interface PlanVisitor<Ret, Arg = never> {
  visitRecursion(operator: operators.Recursion, arg?: Arg): Ret;
  visitIndexedRecursion(operator: operators.IndexedRecursion, arg?: Arg): Ret;
  visitBidirectionalRecursion(
    operator: operators.BidirectionalRecursion,
    arg?: Arg,
  ): Ret;
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
  visitIndexScan(operator: operators.IndexScan, arg?: Arg): Ret;
}
