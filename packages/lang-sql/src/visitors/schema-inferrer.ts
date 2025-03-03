import {
  ASTIdentifier,
  boundParam,
  DortDBAsFriend,
  IdSet,
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  toInfer,
} from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import { Trie } from '@dortdb/core/data-structures';
import { isTableAttr } from '../utils/is-table-attr.js';
import { Using } from '../plan/using.js';
import {
  difference,
  overrideSource,
  schemaToTrie,
  union,
} from '@dortdb/core/utils';
import { retI1, toPair } from '@dortdb/core/internal-fns';
import { LangSwitch } from '../plan/langswitch.js';
import { SQLLogicalPlanVisitor } from 'src/plan/index.js';
import { DEFAULT_COLUMN } from './builder.js';

const EMPTY = new Trie<string | symbol>();
function zip<T, U>(a: T[], b: U[]): [T, U][] {
  const res: [T, U][] = [];
  for (let i = 0; i < a.length; i++) {
    res.push([a[i], b[i]]);
  }
  return res;
}

/**
 * Infers the schema of a logical plan.
 * Each method returns external references.
 */
export class SchemaInferrer implements SQLLogicalPlanVisitor<IdSet, IdSet> {
  constructor(
    private vmap: Record<string, SQLLogicalPlanVisitor<IdSet, IdSet>>,
    private db: DortDBAsFriend,
  ) {}

  public inferSchema(operator: LogicalPlanOperator, ctx: IdSet): IdSet {
    const external = operator.accept(this.vmap, ctx);
    for (const item of external.keys([boundParam])) {
      external.delete(item);
    }
    return external;
  }

  visitProjection(operator: plan.Projection, ctx: IdSet): IdSet {
    // additional appended attrs through upper operators
    const external = schemaToTrie(operator.schema.slice(operator.attrs.length));
    operator.removeFromSchema(external);

    ctx = union(ctx, operator.source.schema);
    for (const attr of operator.attrs) {
      this.processArg(operator.source, attr[0], ctx);
    }
    for (const item of operator.source.accept(this.vmap, ctx)) {
      external.add(item);
    }
    return external;
  }

  private processArg(
    operator: LogicalPlanTupleOperator,
    arg: ASTIdentifier | LogicalPlanOperator,
    ctx: IdSet,
  ) {
    if (arg instanceof ASTIdentifier) {
      operator.addToSchema(arg);
    } else {
      operator.addToSchema(arg.accept(this.vmap, ctx));
    }
  }
  visitSelection(operator: plan.Selection, ctx: IdSet): IdSet {
    this.processArg(operator, operator.condition, union(ctx, operator.schema));
    return operator.source.accept(this.vmap, ctx);
  }
  visitTupleSource(operator: plan.TupleSource, ctx: IdSet): IdSet {
    const external = new Trie<string | symbol>();
    const name =
      operator.name instanceof ASTIdentifier ? operator.name : operator.name[1];
    for (const attr of operator.schema.slice()) {
      if (attr.parts.length > 1 && !isTableAttr(attr, name)) {
        operator.removeFromSchema(attr);
        external.add(attr.parts);
      } else if (attr.parts[attr.parts.length - 1] === toInfer) {
        operator.removeFromSchema(attr);
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
    ctx: IdSet,
  ): IdSet {
    const external = new Trie<string | symbol>();
    for (const arg of operator.args) {
      if (arg instanceof ASTIdentifier) {
        external.add(arg.parts);
      } else {
        for (const item of arg.accept(this.vmap, ctx)) {
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
    if (
      operator instanceof plan.TupleSource ||
      operator instanceof plan.TupleFnSource
    ) {
      return operator.name instanceof ASTIdentifier
        ? schemaToTrie([operator.name])
        : schemaToTrie([operator.name[1]]);
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

    const res = new Trie<string | symbol>();
    res.add(operator.schema[0].parts.slice(0, -1));
    return res;
  }
  visitCartesianProduct(operator: plan.CartesianProduct, ctx: IdSet): IdSet {
    const external = new Trie<string | symbol>();
    const leftNames = this.getRelNames(operator.left);
    const rightNames = this.getRelNames(operator.right);
    for (const item of leftNames) {
      if (rightNames.has(item))
        throw new Error('Duplicate table alias: ' + item.join('.'));
    }

    for (const item of operator.schema.slice()) {
      if (item.parts.length === 1) {
        throw new Error(`Ambiguous column name: ${item.parts[0]?.toString()}`);
      }
      if (isTableAttr(item, leftNames)) {
        if (item.parts[item.parts.length - 1] === toInfer) {
          operator.removeFromSchema(item);
        } else {
          operator.left.addToSchema(item);
        }
      } else if (isTableAttr(item, rightNames)) {
        if (item.parts[item.parts.length - 1] === toInfer) {
          operator.removeFromSchema(item);
        } else {
          operator.right.addToSchema(item);
        }
      } else {
        external.add(item.parts);
      }
    }
    operator.removeFromSchema(external);

    for (const item of operator.left.accept(this.vmap, ctx)) {
      external.add(item);
    }
    for (const item of operator.right.accept(this.vmap, ctx)) {
      external.add(item);
    }

    return external;
  }
  visitJoin(operator: plan.Join, ctx: IdSet): IdSet {
    if (operator.on) {
      this.processArg(operator, operator.on, union(ctx, operator.schema));
    }
    return this.visitCartesianProduct(operator, ctx);
  }
  visitProjectionConcat(operator: plan.ProjectionConcat, ctx: IdSet): IdSet {
    const horizontal = operator.mapping.accept(
      this.vmap,
      union(ctx, operator.source.schema),
    );
    operator.source.addToSchema(horizontal);
    const vertical = operator.source.accept(this.vmap, ctx);
    operator.clearSchema();
    operator.addToSchema(
      operator.source.schema.concat(operator.mapping.schema),
    );
    return vertical;
  }
  visitMapToItem(operator: plan.MapToItem, ctx: IdSet): IdSet {
    const fromLS = operator.source instanceof LangSwitch;
    const res = operator.source.accept(this.vmap, ctx);
    if (fromLS && operator.source.schema.length === 1) {
      operator.key = operator.source.schema[0];
    }
    return res;
  }
  visitMapFromItem(operator: plan.MapFromItem, ctx: IdSet): IdSet {
    const external = operator.source.accept(this.vmap, ctx);
    while (operator.schema.length > 1) {
      external.add(operator.schema[1].parts);
      operator.removeFromSchema(operator.schema[1]);
    }
    return external;
  }
  visitProjectionIndex(operator: plan.ProjectionIndex, ctx: IdSet): IdSet {
    const external = operator.source.accept(this.vmap, ctx);
    operator.removeFromSchema(external);

    const index = operator.schema.indexOf(operator.indexCol);
    const temp = operator.schema[operator.schema.length - 1];
    operator.schema[index] = temp;
    operator.schema[operator.schema.length - 1] = operator.indexCol;

    return external;
  }
  visitOrderBy(operator: plan.OrderBy, ctx: IdSet): IdSet {
    const tempSchema = new plan.NullSource('sql');
    const attrCtx = union(ctx, operator.source.schema);
    for (const item of operator.orders) {
      this.processArg(tempSchema, item.key, attrCtx);
    }
    operator.source.addToSchema(tempSchema.schema);
    const external = operator.source.accept(this.vmap, ctx);
    const proj = operator instanceof plan.Distinct ? operator.source : operator;

    if (proj instanceof plan.Projection) {
      // otherwise it's a set op
      const parentProj = new plan.Projection(
        'sql',
        proj.attrs.slice(),
        operator,
      );
      for (const oitem of operator.orders) {
        if (
          oitem.key instanceof ASTIdentifier &&
          !proj.schemaSet.has(oitem.key.parts)
        ) {
          proj.addToSchema(oitem.key);
          proj.attrs.push([oitem.key, oitem.key]);
        } else if (oitem.key instanceof plan.Calculation) {
          for (const attr of difference(tempSchema.schemaSet, external)) {
            if (!proj.schemaSet.has(attr)) {
              const id = ASTIdentifier.fromParts(attr);
              proj.addToSchema(id);
              proj.attrs.push([id, id]);
            }
          }
        }
      }
      operator.parent.replaceChild(operator, parentProj);
    }

    return external;
  }
  visitGroupBy(operator: plan.GroupBy, ctx: IdSet): IdSet {
    // additional appended attrs through upper operators
    const external = schemaToTrie(
      operator.schema.slice(operator.keys.length + operator.aggs.length),
    );
    operator.removeFromSchema(external);

    const keyCtx = union(ctx, operator.source.schema);
    for (const attr of operator.keys) {
      this.processArg(operator.source, attr[0], keyCtx);
    }
    for (const agg of operator.aggs) {
      for (const arg of agg.args) {
        this.processArg(operator.source, arg, ctx);
      }
      for (const item of agg.postGroupOp.accept(this.vmap, ctx)) {
        external.add(item);
      }
    }
    for (const item of operator.source.accept(this.vmap, ctx)) {
      external.add(item);
    }

    return external;
  }

  visitLimit(operator: plan.Limit, ctx: IdSet): IdSet {
    return operator.source.accept(this.vmap, ctx);
  }

  private processSetOp(operator: plan.SetOperator, ctx: IdSet) {
    const left = operator.left.accept(this.vmap, ctx);
    const right = operator.right.accept(this.vmap, ctx);
    for (const item of right) {
      left.add(item);
    }
    return left;
  }

  visitUnion(operator: plan.Union, ctx: IdSet): IdSet {
    return this.processSetOp(operator, ctx);
  }
  visitIntersection(operator: plan.Intersection, ctx: IdSet): IdSet {
    return this.processSetOp(operator, ctx);
  }
  visitDifference(operator: plan.Difference, ctx: IdSet): IdSet {
    return this.processSetOp(operator, ctx);
  }
  visitDistinct(operator: plan.Distinct, ctx: IdSet): IdSet {
    if (Array.isArray(operator.attrs)) {
      const attrCtx = union(ctx, operator.schema);
      for (const item of operator.attrs) {
        this.processArg(operator, item, attrCtx);
      }
    }
    return operator.source.accept(this.vmap, ctx);
  }
  visitNullSource(operator: plan.NullSource, ctx: IdSet): IdSet {
    return operator.schemaSet;
  }
  visitAggregate(operator: plan.AggregateCall, ctx: IdSet): IdSet {
    throw new Error('Method not implemented.');
  }
  visitItemFnSource(operator: plan.ItemFnSource, ctx: IdSet): IdSet {
    return this.visitCalculation(operator, ctx);
  }
  visitTupleFnSource(operator: plan.TupleFnSource, ctx: IdSet): IdSet {
    const external = this.visitCalculation(operator, ctx);
    if (operator.name) {
      const n =
        operator.name instanceof ASTIdentifier
          ? operator.name
          : operator.name[1];
      for (const attr of operator.schema.slice()) {
        if (attr.parts.length > 1 && !isTableAttr(attr, n)) {
          operator.removeFromSchema(attr);
          external.add(attr.parts);
        } else if (attr.parts[attr.parts.length - 1] === toInfer) {
          operator.removeFromSchema(attr);
        }
      }
    }
    return external;
  }
  visitQuantifier(operator: plan.Quantifier): IdSet {
    throw new Error('Method not implemented.');
  }

  visitUsing(operator: Using, ctx: IdSet): IdSet {
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
        .filter(
          (x) =>
            !operator.toRemove.has(x.parts) &&
            x.parts[x.parts.length - 1] !== toInfer,
        )
        .map(toPair),
    );
    // some columns might have been inferred from above, so we will get them this way
    operator.removeFromSchema(projectedCols.map(retI1));
    for (const item of operator.schema) {
      if (item.parts[item.parts.length - 1] !== toInfer) {
        projectedCols.push([item, item]);
      }
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
    return replacement.accept(this.vmap, ctx);
  }

  visitLangSwitch(operator: LangSwitch, ctx: IdSet): IdSet {
    const nested = new (this.db.langMgr.getLang(
      operator.node.lang,
    ).visitors.logicalPlanBuilder)(this.db).buildPlan(operator.node.node, ctx);
    let res = !(nested.plan instanceof LogicalPlanTupleOperator)
      ? new plan.MapFromItem('sql', DEFAULT_COLUMN, nested.plan)
      : nested.plan;
    if (operator.alias) {
      res = new plan.Projection(
        'sql',
        res.schema.map((x) => [x, overrideSource(operator.alias, x)]),
        res,
      );
    }

    const external = nested.inferred;
    for (const item of operator.schemaSet) {
      if (!res.schemaSet.has(item)) {
        external.add(item);
      }
    }

    operator.parent.replaceChild(operator, res);
    return external;
  }
}
