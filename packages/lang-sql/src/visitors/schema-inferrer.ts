import {
  ASTIdentifier,
  IdSet,
  LanguageManager,
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import { Trie } from 'mnemonist';
import { isTableAttr } from '../utils/is-table-attr.js';
import { Using } from '../plan/using.js';
import { overrideSource, schemaToTrie } from '@dortdb/core/utils';

const EMPTY = new Trie<(string | symbol)[]>(Array);
function toPair<T>(x: T): [T, T] {
  return [x, x];
}
function zip<T, U>(a: T[], b: U[]): [T, U][] {
  const res: [T, U][] = [];
  for (let i = 0; i < a.length; i++) {
    res.push([a[i], b[i]]);
  }
  return res;
}
function retI1<T>(a: [unknown, T, ...unknown[]]): T {
  return a[1];
}

/**
 * Infers the schema of a logical plan.
 * Each method returns external references.
 */
export class SchemaInferrer implements LogicalPlanVisitor<IdSet> {
  constructor(
    private vmap: Record<string, LogicalPlanVisitor<IdSet>>,
    private langMgr: LanguageManager,
  ) {}

  /**
   * conditional down traversal. Only use if the source can be a langswitch
   */
  private downCond(v: LogicalPlanOperator & { source: LogicalPlanOperator }) {
    if (v.source.lang === 'sql') {
      return v.source.accept(this.vmap);
    }
    return EMPTY;
  }

  visitProjection(operator: plan.Projection): IdSet {
    // additional appended attrs through upper operators
    const external = schemaToTrie(operator.schema.slice(operator.attrs.length));
    operator.removeFromSchema(external);

    for (const attr of operator.attrs) {
      this.processArg(operator.source, attr[0]);
    }
    for (const item of this.downCond(operator)) {
      external.add(item);
    }
    return external;
  }

  private processArg(
    operator: LogicalPlanTupleOperator,
    arg: ASTIdentifier | LogicalPlanOperator,
  ) {
    if (arg instanceof ASTIdentifier) {
      operator.addToSchema(arg);
    } else {
      operator.addToSchema(arg.accept(this.vmap));
    }
  }
  visitSelection(operator: plan.Selection): IdSet {
    this.processArg(operator, operator.condition);
    return operator.source.accept(this.vmap);
  }
  visitTupleSource(operator: plan.TupleSource): IdSet {
    const external = new Trie<(string | symbol)[]>(Array);
    const name =
      operator.name instanceof ASTIdentifier ? operator.name : operator.name[1];
    for (const attr of operator.schema) {
      if (attr.parts.length > 1 && !isTableAttr(attr, name)) {
        external.add(attr.parts);
      }
    }
    return external;
  }
  visitItemSource(operator: plan.ItemSource): IdSet {
    return EMPTY;
  }
  visitFnCall(operator: plan.FnCall): IdSet {
    throw new Error('Method not implemented.');
  }
  visitLiteral(operator: plan.Literal): IdSet {
    throw new Error('Method not implemented.');
  }
  visitCalculation(
    operator: plan.Calculation | plan.ItemFnSource | plan.TupleFnSource,
  ): IdSet {
    const external = new Trie<(string | symbol)[]>(Array);
    for (const arg of operator.args) {
      if (arg instanceof ASTIdentifier) {
        external.add(arg.parts);
      } else if (arg.lang === 'sql') {
        for (const item of arg.accept(this.vmap)) {
          external.add(item);
        }
      }
    }
    return external;
  }
  visitConditional(operator: plan.Conditional): IdSet {
    throw new Error('Method not implemented.');
  }

  private getRelNames(operator: LogicalPlanTupleOperator): IdSet {
    // joins are made of either TupleSources or Projections based on table aliases or other joins
    if (operator instanceof plan.TupleSource) {
      return operator.name instanceof ASTIdentifier
        ? schemaToTrie([operator.name])
        : schemaToTrie([operator.name[1]]);
    }
    if (operator instanceof plan.TupleFnSource) {
      // alias for table functions is required in our grammar
      return schemaToTrie([operator.alias]);
    }

    if (operator instanceof plan.CartesianProduct) {
      const res = this.getRelNames(operator.left);
      for (const item of this.getRelNames(operator.right)) {
        if (res.has(item))
          throw new Error('Duplicate table alias: ' + item.join('.'));
        res.add(item);
      }
      return res;
    }

    const res = new Trie<(string | symbol)[]>(Array);
    res.add(operator.schema[0].parts.slice(0, -1));
    return res;
  }
  visitCartesianProduct(operator: plan.CartesianProduct): IdSet {
    const external = new Trie<(string | symbol)[]>(Array);
    const leftNames = this.getRelNames(operator.left);
    const rightNames = this.getRelNames(operator.right);
    for (const item of leftNames) {
      if (rightNames.has(item))
        throw new Error('Duplicate table alias: ' + item.join('.'));
    }

    for (const item of operator.schema) {
      if (item.parts.length === 1) {
        throw new Error(`Ambiguous column name: ${item.parts[0]?.toString()}`);
      }
      if (isTableAttr(item, leftNames)) {
        operator.left.addToSchema(item);
      } else if (isTableAttr(item, rightNames)) {
        operator.right.addToSchema(item);
      } else {
        external.add(item.parts);
      }
    }
    operator.removeFromSchema(external);

    if (operator.left.lang === 'sql') {
      for (const item of operator.left.accept(this.vmap)) {
        external.add(item);
      }
    }
    if (operator.right.lang === 'sql') {
      for (const item of operator.right.accept(this.vmap)) {
        external.add(item);
      }
    }

    return external;
  }
  visitJoin(operator: plan.Join): IdSet {
    if (operator.on) {
      this.processArg(operator, operator.on);
    }
    return this.visitCartesianProduct(operator);
  }
  visitProjectionConcat(operator: plan.ProjectionConcat): IdSet {
    const horizontal =
      operator.mapping.lang === 'sql'
        ? operator.mapping.accept(this.vmap)
        : EMPTY;
    operator.source.addToSchema(horizontal);
    const vertical = this.downCond(operator);
    operator.clearSchema();
    operator.addToSchema(
      operator.source.schema.concat(operator.mapping.schema),
    );
    return vertical;
  }
  visitMapToItem(operator: plan.MapToItem): IdSet {
    return this.downCond(operator);
  }
  visitMapFromItem(operator: plan.MapFromItem): IdSet {
    const external = this.downCond(operator);
    while (operator.schema.length > 1) {
      external.add(operator.schema[1].parts);
      operator.removeFromSchema(operator.schema[1]);
    }
    return external;
  }
  visitProjectionIndex(operator: plan.ProjectionIndex): IdSet {
    const external = this.downCond(operator);
    operator.removeFromSchema(external);

    const index = operator.schema.indexOf(operator.indexCol);
    const temp = operator.schema[operator.schema.length - 1];
    operator.schema[index] = temp;
    operator.schema[operator.schema.length - 1] = operator.indexCol;

    return external;
  }
  visitOrderBy(operator: plan.OrderBy): IdSet {
    return operator.source.accept(this.vmap);
  }
  visitGroupBy(operator: plan.GroupBy): IdSet {
    // additional appended attrs through upper operators
    const external = schemaToTrie(
      operator.schema.slice(operator.keys.length + operator.aggs.length),
    );
    operator.removeFromSchema(external);

    for (const attr of operator.keys) {
      this.processArg(operator.source, attr[0]);
    }
    for (const agg of operator.aggs) {
      for (const arg of agg.args) {
        this.processArg(operator.source, arg);
      }
      operator.source.addToSchema(agg.postGroupOp.accept(this.vmap));
    }
    for (const item of this.downCond(operator)) {
      external.add(item);
    }
    return external;
  }
  visitLimit(operator: plan.Limit): IdSet {
    return operator.source.accept(this.vmap);
  }

  private processSetOp(operator: plan.SetOperator) {
    const left =
      operator.left.lang === 'sql' ? operator.left.accept(this.vmap) : EMPTY;
    const right =
      operator.right.lang === 'sql' ? operator.right.accept(this.vmap) : EMPTY;
    for (const item of right) {
      left.add(item);
    }
    return left;
  }

  visitUnion(operator: plan.Union): IdSet {
    return this.processSetOp(operator);
  }
  visitIntersection(operator: plan.Intersection): IdSet {
    return this.processSetOp(operator);
  }
  visitDifference(operator: plan.Difference): IdSet {
    return this.processSetOp(operator);
  }
  visitDistinct(operator: plan.Distinct): IdSet {
    return operator.source.accept(this.vmap);
  }
  visitNullSource(operator: plan.NullSource): IdSet {
    return EMPTY;
  }
  visitAggregate(operator: plan.AggregateCall): IdSet {
    throw new Error('Method not implemented.');
  }
  visitItemFnSource(operator: plan.ItemFnSource): IdSet {
    return this.visitCalculation(operator);
  }
  visitTupleFnSource(operator: plan.TupleFnSource): IdSet {
    const external = this.visitCalculation(operator);
    if (operator.alias) {
      for (const attr of operator.schema) {
        if (attr.parts.length > 1 && !isTableAttr(attr, operator.alias)) {
          external.add(attr.parts);
        }
      }
    }
    return external;
  }
  visitQuantifier(operator: plan.Quantifier): IdSet {
    throw new Error('Method not implemented.');
  }

  visitUsing(operator: Using): IdSet {
    const condition = new plan.Calculation(
      'sql',
      (...args) => {
        const half = args.length / 2;
        for (let i = 0; i < half; i++) {
          if (args[i] !== args[i + half]) return false;
        }
        return true;
      },
      operator.overriddenCols.concat(
        operator.columns.map((c) => overrideSource(operator.rightName, c)),
      ),
    );
    let replacement: LogicalPlanTupleOperator = new plan.Selection(
      'sql',
      condition,
      operator.source,
    );

    const projectedCols = zip(operator.overriddenCols, operator.columns);
    projectedCols.push(
      ...replacement.schema
        .filter((x) => !operator.toRemove.has(x.parts))
        .map(toPair),
    );
    // some columns might have been inferred from above, so we will get them this way
    operator.removeFromSchema(projectedCols.map(retI1));
    for (const item of operator.schema) {
      projectedCols.push([item, item]);
    }
    replacement = new plan.Projection('sql', projectedCols, replacement);

    if (
      (operator.parent as LogicalPlanTupleOperator).schema === operator.schema
    ) {
      // need to preserve references
      operator.clearSchema();
      operator.addToSchema(replacement.schema);
      replacement.schema = operator.schema;
    }
    operator.parent.replaceChild(operator, replacement);
    return replacement.accept(this.vmap);
  }
}
