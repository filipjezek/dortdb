import { isEqual } from 'lodash-es';
import { allAttrs, ASTIdentifier } from '../ast.js';
import { isId, ret1, retI0, retI1 } from '../internal-fns/index.js';
import * as plan from '../plan/operators/index.js';
import { OpOrId, PlanOperator, PlanVisitor } from '../plan/visitor.js';
import { containsAll } from '../utils/trie.js';

export interface DescentArgs {
  other: PlanOperator;
  ignoreLang?: boolean;
}

export class EqualityChecker implements PlanVisitor<boolean, DescentArgs> {
  constructor(
    protected vmap: Record<string, PlanVisitor<boolean, DescentArgs>>,
  ) {}

  protected processItem(
    operator: OpOrId,
    { other, ignoreLang }: { other: OpOrId; ignoreLang?: boolean },
  ): boolean {
    if (operator.constructor !== other.constructor) {
      for (const [a, b] of [
        [operator, other],
        [other, operator],
      ]) {
        if (
          a instanceof ASTIdentifier &&
          b instanceof plan.FnCall &&
          b.impl === ret1 &&
          b.args.length === 1 &&
          b.args[0] instanceof ASTIdentifier &&
          b.args[0].equals(a)
        ) {
          return true;
        }
      }
      return false;
    }

    if (operator instanceof ASTIdentifier) {
      return operator.equals(other as ASTIdentifier);
    }
    if (!ignoreLang && operator.lang !== (other as PlanOperator).lang) {
      return false;
    }
    return operator.accept(this.vmap, {
      other: other as PlanOperator,
      ignoreLang,
    });
  }

  protected processArray(
    arrA: OpOrId[],
    arrB: OpOrId[],
    args: DescentArgs,
  ): boolean {
    if (arrA.length !== arrB.length) {
      return false;
    }
    return arrA.every((item, i) =>
      this.processItem(item, { ...args, other: arrB[i] }),
    );
  }

  public areEqual(op1: OpOrId, op2: OpOrId, ignoreLang = false) {
    return this.processItem(op1, { other: op2, ignoreLang });
  }

  visitRecursion(a: plan.Recursion, args: DescentArgs): boolean {
    const b = args.other as plan.Recursion;
    return (
      a.min === b.min &&
      a.max === b.max &&
      this.processItem(a.condition, { ...args, other: b.condition }) &&
      this.processItem(a.source, { ...args, other: b.source })
    );
  }
  visitProjection(a: plan.Projection, args: DescentArgs): boolean {
    const b = args.other as plan.Projection;
    return (
      a.attrs.length === b.attrs.length &&
      a.attrs.every((attr, i) => {
        const battr = b.attrs[i];
        return (
          attr[1].equals(battr[1]) &&
          this.processItem(attr[0], { ...args, other: battr[0] })
        );
      }) &&
      this.processItem(a.source, { ...args, other: b.source })
    );
  }
  visitSelection(a: plan.Selection, args: DescentArgs): boolean {
    const b = args.other as plan.Selection;
    return (
      this.processItem(a.condition, { ...args, other: b.condition }) &&
      this.processItem(a.source, { ...args, other: b.source })
    );
  }
  visitTupleSource(a: plan.TupleSource, args: DescentArgs): boolean {
    return this.visitItemSource(a as plan.ItemSource, args);
  }
  visitItemSource(a: plan.ItemSource, args: DescentArgs): boolean {
    const b = args.other as plan.TupleSource;
    if (Array.isArray(a.name)) {
      return (
        Array.isArray(b.name) &&
        a.name[0].equals(b.name[0]) &&
        a.name[1].equals(b.name[1])
      );
    }
    return !Array.isArray(b.name) && a.name.equals(b.name);
  }
  visitFnCall(a: plan.FnCall, args: DescentArgs): boolean {
    const b = args.other as plan.FnCall;
    return (
      a.impl === b.impl &&
      a.args.length === b.args.length &&
      a.args.every((arg, i) => {
        const barg = b.args[i];
        return this.processItem('op' in arg ? arg.op : arg, {
          ...args,
          other: 'op' in barg ? barg.op : barg,
        });
      })
    );
  }
  visitLiteral(a: plan.Literal, args: DescentArgs): boolean {
    const b = args.other as plan.Literal;
    return isEqual(a.value, b.value);
  }
  visitCalculation(a: plan.Calculation, args: DescentArgs): boolean {
    const b = args.other as plan.Calculation;
    return (
      this.processArray(a.args, b.args, args) &&
      !!a.original === !!b.original &&
      (a.original
        ? this.processItem(a.original, { ...args, other: b.original })
        : a.impl === b.impl)
    );
  }
  visitConditional(a: plan.Conditional, args: DescentArgs): boolean {
    const b = args.other as plan.Conditional;
    return (
      this.processArray(a.whenThens.map(retI0), b.whenThens.map(retI0), args) &&
      this.processArray(a.whenThens.map(retI1), b.whenThens.map(retI1), args) &&
      (a.condition
        ? !!b.condition &&
          this.processItem(a.condition, { ...args, other: b.condition })
        : !b.condition) &&
      (a.defaultCase
        ? !!b.defaultCase &&
          this.processItem(a.defaultCase, { ...args, other: b.defaultCase })
        : !b.defaultCase)
    );
  }
  visitCartesianProduct(a: plan.CartesianProduct, args: DescentArgs): boolean {
    const b = args.other as plan.CartesianProduct;
    return (
      this.processItem(a.left, { ...args, other: b.left }) &&
      this.processItem(a.right, { ...args, other: b.right })
    );
  }
  visitJoin(a: plan.Join, args: DescentArgs): boolean {
    const b = args.other as plan.Join;
    return (
      a.leftOuter === b.leftOuter &&
      a.rightOuter === b.rightOuter &&
      this.processArray(a.conditions, b.conditions, args) &&
      this.visitCartesianProduct(a, args)
    );
  }
  visitProjectionConcat(a: plan.ProjectionConcat, args: DescentArgs): boolean {
    const b = args.other as plan.ProjectionConcat;
    return (
      a.outer === b.outer &&
      a.emptyVal.size === b.emptyVal.size &&
      containsAll(a.emptyVal, b.emptyVal) &&
      this.processItem(a.mapping, { ...args, other: b.mapping }) &&
      this.processItem(a.source, { ...args, other: b.source })
    );
  }
  visitMapToItem(a: plan.MapToItem, args: DescentArgs): boolean {
    const b = args.other as plan.MapToItem;
    return (
      a.key.equals(b.key) &&
      this.processItem(a.source, { ...args, other: b.source })
    );
  }
  visitMapFromItem(a: plan.MapFromItem, args: DescentArgs): boolean {
    const b = args.other as plan.MapFromItem;
    return (
      a.key.equals(b.key) &&
      this.processItem(a.source, { ...args, other: b.source })
    );
  }
  visitProjectionIndex(a: plan.ProjectionIndex, args: DescentArgs): boolean {
    const b = args.other as plan.ProjectionIndex;
    return (
      a.indexCol.equals(b.indexCol) &&
      this.processItem(a.source, { ...args, other: b.source })
    );
  }
  visitOrderBy(a: plan.OrderBy, args: DescentArgs): boolean {
    const b = args.other as plan.OrderBy;
    return (
      a.orders.length === b.orders.length &&
      a.orders.every((order, i) => {
        const border = b.orders[i];
        return (
          order.ascending === border.ascending &&
          order.nullsFirst === border.nullsFirst &&
          this.processItem(order.key, { ...args, other: border.key })
        );
      }) &&
      this.processItem(a.source, { ...args, other: b.source })
    );
  }
  visitGroupBy(a: plan.GroupBy, args: DescentArgs): boolean {
    const b = args.other as plan.GroupBy;
    return (
      a.keys.length === b.keys.length &&
      a.keys.every((key, i) => {
        const bkey = b.keys[i];
        return (
          key[1].equals(bkey[1]) &&
          this.processItem(key[0], { ...args, other: bkey[0] })
        );
      }) &&
      this.processArray(a.aggs, b.aggs, args) &&
      this.processItem(a.source, { ...args, other: b.source })
    );
  }
  visitLimit(a: plan.Limit, args: DescentArgs): boolean {
    const b = args.other as plan.Limit;
    return (
      a.limit === b.limit &&
      a.skip === b.skip &&
      this.processItem(a.source, { ...args, other: b.source })
    );
  }
  protected visitSetOp(a: plan.SetOperator, args: DescentArgs): boolean {
    const b = args.other as plan.SetOperator;
    return (
      this.processItem(a.left, { ...args, other: b.left }) &&
      this.processItem(a.right, { ...args, other: b.right })
    );
  }
  visitUnion(a: plan.Union, args: DescentArgs): boolean {
    return this.visitSetOp(a, args);
  }
  visitIntersection(a: plan.Intersection, args: DescentArgs): boolean {
    return this.visitSetOp(a, args);
  }
  visitDifference(a: plan.Difference, args: DescentArgs): boolean {
    return this.visitSetOp(a, args);
  }
  visitDistinct(a: plan.Distinct, args: DescentArgs): boolean {
    const b = args.other as plan.Distinct;
    for (const [alls, somes] of [
      [a, b],
      [b, a],
    ]) {
      if (alls.attrs === allAttrs && somes.attrs !== allAttrs) {
        const somesIds = somes.attrs.filter(isId);
        if (
          somesIds.length !== somes.attrs.length ||
          somesIds.length !== alls.schema.length ||
          !containsAll(alls.schemaSet, somesIds)
        ) {
          return false;
        }
      }
    }
    if (a.attrs !== allAttrs) {
      if (!this.processArray(a.attrs, b.attrs as OpOrId[], args)) return false;
    }
    return this.processItem(a.source, { ...args, other: b.source });
  }
  visitNullSource(a: plan.NullSource, args: DescentArgs): boolean {
    return true;
  }
  visitAggregate(a: plan.AggregateCall, args: DescentArgs): boolean {
    const b = args.other as plan.AggregateCall;
    return (
      a.impl === b.impl &&
      a.fieldName.equals(b.fieldName) &&
      this.processItem(a.postGroupOp, { ...args, other: b.postGroupOp }) &&
      this.processArray(a.args, b.args, args)
    );
  }
  visitItemFnSource(a: plan.ItemFnSource, args: DescentArgs): boolean {
    const b = args.other as plan.ItemFnSource;
    return a.impl === b.impl && this.processArray(a.args, b.args, args);
  }
  visitTupleFnSource(a: plan.TupleFnSource, args: DescentArgs): boolean {
    const b = args.other as plan.ItemFnSource;
    return a.impl === b.impl && this.processArray(a.args, b.args, args);
  }
  visitQuantifier(a: plan.Quantifier, args: DescentArgs): boolean {
    const b = args.other as plan.Quantifier;
    return (
      a.type === b.type &&
      this.processItem(a.query, { ...args, other: b.query })
    );
  }
}
