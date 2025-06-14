import {
  allAttrs,
  ASTIdentifier,
  boundParam,
  DortDBAsFriend,
  IdSet,
  PlanOperator,
  PlanTupleOperator,
  toInfer,
} from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import { Trie } from '@dortdb/core/data-structures';
import { isTableAttr } from '../utils/is-table-attr.js';
import { Using } from '../plan/using.js';
import {
  difference,
  linkSchemaToParent,
  overrideSource,
  schemaToTrie,
  union,
} from '@dortdb/core/utils';
import { retI1, toPair } from '@dortdb/core/internal-fns';
import { LangSwitch } from '../plan/langswitch.js';
import { SQLPlanVisitor } from '../plan/index.js';
import { defaultCol } from './builder.js';

const EMPTY = new Trie<string | symbol | number>();
function zip<T, U>(a: T[], b: U[]): [T, U][] {
  const res: [T, U][] = [];
  for (let i = 0; i < a.length; i++) {
    res.push([a[i], b[i]]);
  }
  return res;
}
function getUnd(): undefined {
  return undefined;
}

/**
 * Infers the schema of a logical plan.
 * Each method returns external references.
 */
export class SchemaInferrer implements SQLPlanVisitor<IdSet, IdSet> {
  constructor(
    protected vmap: Record<string, SQLPlanVisitor<IdSet, IdSet>>,
    protected db: DortDBAsFriend,
  ) {}

  public inferSchema(
    operator: PlanOperator,
    ctx: IdSet,
  ): [PlanOperator, IdSet] {
    const tempHead = new plan.Limit('sql', 0, 1, operator);
    const external = operator.accept(this.vmap, ctx);
    for (const item of external.keys([boundParam])) {
      external.delete(item);
    }
    return [tempHead.source, external];
  }

  visitProjection(operator: plan.Projection, ctx: IdSet): IdSet {
    // additional appended attrs through upper operators
    const external = schemaToTrie(operator.schema.slice(operator.attrs.length));
    operator.removeFromSchema(external);

    // created by langswitch
    if (operator.source.lang !== 'sql') return external;

    ctx = union(ctx, operator.source.schema);
    for (const attr of operator.attrs) {
      this.processArg(operator.source, attr[0], ctx);
    }
    for (const item of operator.source.accept(this.vmap, ctx)) {
      external.add(item);
    }
    external.delete([allAttrs]);
    return external;
  }

  protected processArg(
    operator: PlanTupleOperator,
    arg: ASTIdentifier | PlanOperator,
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
  visitRecursion(operator: plan.Recursion, ctx: IdSet): IdSet {
    if (operator.condition) {
      this.processArg(
        operator,
        operator.condition,
        union(ctx, operator.schema),
      );
    }
    return operator.source.accept(this.vmap, ctx);
  }

  protected renameTupleSourceAttrs(
    operator: plan.TupleSource | plan.TupleFnSource,
  ) {
    const toRemove: ASTIdentifier[] = [];
    const parent = operator.parent;
    const keepSchemaRef =
      parent instanceof PlanTupleOperator && operator.schema === parent.schema;
    const proj = new plan.Projection(
      'sql',
      operator.schema.map((id) => {
        if (id.parts.length > 1) {
          toRemove.push(id);
          const shortened = ASTIdentifier.fromParts(id.parts.slice(-1));
          operator.addToSchema(shortened);
          return [shortened, id];
        }
        return [id, id];
      }),
      operator,
    );
    parent.replaceChild(operator, proj);
    if (keepSchemaRef) {
      operator.schema = operator.schema.filter(
        (x) => !toRemove.find((y) => x.equals(y)),
      );
      operator.schemaSet = schemaToTrie(operator.schema);
      linkSchemaToParent(proj);
    } else {
      operator.removeFromSchema(toRemove);
    }
  }

  visitTupleSource(operator: plan.TupleSource, ctx: IdSet): IdSet {
    const external = new Trie<string | symbol | number>();
    const name =
      operator.name instanceof ASTIdentifier ? operator.name : operator.name[1];
    let hasRenamedAttrs = false;
    for (const attr of operator.schema.slice()) {
      if (attr.parts.length > 1 && !isTableAttr(attr, name)) {
        operator.removeFromSchema(attr);
        external.add(attr.parts);
      } else if (attr.parts.at(-1) === toInfer || attr.parts[0] === allAttrs) {
        operator.removeFromSchema(attr);
      } else if (attr.parts.length > 1) {
        hasRenamedAttrs = true;
      }
    }

    if (hasRenamedAttrs) {
      this.renameTupleSourceAttrs(operator);
    }
    if (Array.isArray(operator.name)) {
      operator.name = operator.name[0];
    }

    return external;
  }
  visitIndexScan(operator: plan.IndexScan, ctx: IdSet): IdSet {
    this.processArg(operator, operator.access, union(ctx, operator.schema));
    return this.visitTupleSource(operator, ctx);
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
    const external = new Trie<string | symbol | number>();
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

  protected getRelNames(operator: PlanTupleOperator): IdSet {
    while (
      'source' in operator &&
      operator.lang === 'sql' &&
      operator.source instanceof PlanTupleOperator
    ) {
      operator = operator.source;
    }
    // joins are made of either TupleSources or Projections based on table aliases or other joins or langswitches
    if (
      operator instanceof plan.TupleSource ||
      operator instanceof plan.TupleFnSource
    ) {
      return operator.name instanceof ASTIdentifier
        ? schemaToTrie([operator.name])
        : schemaToTrie([operator.name[1]]);
    }

    if (
      operator instanceof plan.CartesianProduct ||
      operator instanceof plan.Join ||
      operator instanceof plan.ProjectionConcat
    ) {
      const left =
        operator instanceof plan.ProjectionConcat
          ? operator.source
          : operator.left;
      const right =
        operator instanceof plan.ProjectionConcat
          ? operator.mapping
          : operator.right;
      const res = this.getRelNames(left);
      for (const item of this.getRelNames(right)) {
        if (res.has(item))
          throw new Error('Duplicate table alias: ' + item.join('.'));
        res.add(item);
      }
      return res;
    }

    const res = new Trie<string | symbol | number>();
    if (operator instanceof LangSwitch) {
      res.add([operator.alias]);
      return res;
    } else if (operator.lang !== 'sql') {
      // langswitch already replaced and second pass was triggered (presumably by OrderBy)
      if (operator.parent instanceof plan.MapFromItem)
        operator = operator.parent;
      operator = operator.parent as PlanTupleOperator;
    }
    res.add(operator.schema[0].parts.slice(0, -1));
    return res;
  }
  visitCartesianProduct(operator: plan.CartesianProduct, ctx: IdSet): IdSet {
    const external = new Trie<string | symbol | number>();
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
        if (item.parts.at(-1) === toInfer) {
          operator.removeFromSchema(item);
        } else {
          operator.left.addToSchema(item);
        }
      } else if (isTableAttr(item, rightNames)) {
        if (item.parts.at(-1) === toInfer) {
          operator.removeFromSchema(item);
        } else {
          operator.right.addToSchema(item);
        }
      } else {
        external.add(item.parts);
      }
    }
    operator.removeFromSchema(external);

    // this might modify operator.schema if `left` is a langswitch
    for (const item of operator.left.accept(this.vmap, ctx)) {
      external.add(item);
    }
    // this might modify operator.schema if `right` is a langswitch
    for (const item of operator.right.accept(this.vmap, ctx)) {
      external.add(item);
    }

    return external;
  }
  visitJoin(operator: plan.Join, ctx: IdSet): IdSet {
    for (const cond of operator.conditions) {
      this.processArg(operator, cond, union(ctx, operator.schema));
    }
    return this.visitCartesianProduct(operator, ctx);
  }
  visitProjectionConcat(operator: plan.ProjectionConcat, ctx: IdSet): IdSet {
    const extra = difference(
      operator.schemaSet,
      operator.source.schemaSet,
      operator.mapping.schemaSet,
    );
    extra.delete([allAttrs]);
    operator.mapping.addToSchema(extra);
    // this might modify operator.schema if the mapping is a langswitch
    const horizontal = operator.mapping.accept(
      this.vmap,
      union(ctx, operator.source.schema, extra),
    );
    operator.source.addToSchema(horizontal);
    operator.source.addToSchema(extra);
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
    const external: IdSet =
      operator.source.lang === 'sql'
        ? operator.source.accept(this.vmap, ctx)
        : new Trie();
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
    const temp = operator.schema.at(-1);
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
    const proj =
      operator.source instanceof plan.Distinct
        ? operator.source.source
        : operator.source;

    if (proj instanceof plan.Projection) {
      // otherwise it's a set op or an aggregate
      const external = operator.source.accept(this.vmap, ctx);
      const parent = operator.parent;
      const parentProj = new plan.Projection(
        'sql',
        proj.attrs.map((attr) => [attr[1], attr[1]]),
        operator,
      );

      for (const attr of difference(tempSchema.schemaSet, external)) {
        if (!proj.schemaSet.has(attr)) {
          const id = ASTIdentifier.fromParts(attr);
          proj.addToSchema(id);
          proj.attrs.push([id, id]);
        }
      }

      parent.replaceChild(operator, parentProj);
      if (
        parent instanceof PlanTupleOperator &&
        parent.schema === operator.schema
      ) {
        linkSchemaToParent(parentProj);
      }

      // reconstruct external
      return operator.source.accept(this.vmap, ctx);
    } else if (!(proj instanceof plan.SetOperator)) {
      // aggregate
      operator.source.addToSchema(tempSchema.schema);
      return operator.source.accept(this.vmap, ctx);
    } else {
      return operator.source.accept(this.vmap, ctx);
    }
  }
  visitGroupBy(operator: plan.GroupBy, ctx: IdSet): IdSet {
    const keyCtx = union(ctx, operator.source.schema);
    for (const attr of operator.keys) {
      this.processArg(operator.source, attr[0], keyCtx);
    }
    for (const agg of operator.aggs) {
      for (const arg of agg.args) {
        this.processArg(operator.source, arg, ctx);
      }
      this.processArg(operator.source, agg.postGroupOp, ctx);
    }
    const external = operator.source.accept(this.vmap, ctx);
    operator.clearSchema();
    operator.addToSchema(operator.source.schema);
    operator.addToSchema(operator.aggs.map((x) => x.fieldName));
    return external;
  }

  visitLimit(operator: plan.Limit, ctx: IdSet): IdSet {
    return operator.source.accept(this.vmap, ctx);
  }

  protected processSetOp(operator: plan.SetOperator, ctx: IdSet) {
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
      let hasRenamedAttrs = false;
      for (const attr of operator.schema.slice()) {
        if (attr.parts.length > 1 && !isTableAttr(attr, n)) {
          operator.removeFromSchema(attr);
          external.add(attr.parts);
        } else if (
          attr.parts.at(-1) === toInfer ||
          attr.parts[0] === allAttrs
        ) {
          operator.removeFromSchema(attr);
        } else if (attr.parts.length > 1) {
          hasRenamedAttrs = true;
        }
      }

      if (hasRenamedAttrs) {
        this.renameTupleSourceAttrs(operator);
      }
      if (Array.isArray(operator.name)) {
        operator.name = operator.name[0];
      }
    }
    return external;
  }
  visitQuantifier(operator: plan.Quantifier): IdSet {
    throw new Error('Method not implemented.');
  }

  visitUsing(operator: Using, ctx: IdSet): IdSet {
    const conditionCols = operator.overriddenCols.concat(
      operator.columns.map((c) => overrideSource(operator.rightName, c)),
    );
    const condition = new plan.Calculation(
      'sql',
      (...args) => {
        const half = args.length / 2;
        for (let i = 0; i < half; i++) {
          if (args[i] !== args[i + half]) return false;
        }
        return true;
      },
      conditionCols,
      conditionCols.map(getUnd),
    );
    let replacement: PlanTupleOperator;
    if (operator.source instanceof plan.Join) {
      replacement = operator.source;
      operator.source.conditions.push(condition);
    } else {
      replacement = new plan.Selection('sql', condition, operator.source);
    }

    const projectedCols = zip(operator.overriddenCols, operator.columns);
    projectedCols.push(
      ...replacement.schema
        .filter(
          (x) => !operator.toRemove.has(x.parts) && x.parts.at(-1) !== toInfer,
        )
        .map(toPair),
    );
    // some columns might have been inferred from above, so we will get them this way
    operator.removeFromSchema(projectedCols.map(retI1));
    for (const item of operator.schema) {
      if (item.parts.at(-1) !== toInfer) {
        projectedCols.push([item, item]);
      }
    }
    replacement = new plan.Projection('sql', projectedCols, replacement);

    if ((operator.parent as PlanTupleOperator).schema === operator.schema) {
      linkSchemaToParent(replacement);
    }
    operator.parent.replaceChild(operator, replacement);
    return replacement.accept(this.vmap, ctx);
  }

  visitLangSwitch(operator: LangSwitch, ctx: IdSet): IdSet {
    const nested = new (this.db.langMgr.getLang(
      operator.node.lang,
    ).visitors.logicalPlanBuilder)(this.db).buildPlan(operator.node.node, ctx);
    let res: PlanTupleOperator;
    if (nested.plan instanceof PlanTupleOperator && nested.plan.schema) {
      res = operator.alias
        ? nested.plan
        : new plan.Projection(
            'sql',
            nested.plan.schema.map(toPair),
            nested.plan,
          );
    } else {
      res = new plan.MapFromItem('sql', defaultCol, nested.plan);
    }
    if (operator.alias) {
      res = new plan.Projection(
        'sql',
        res.schema.map((x) => [x, overrideSource(operator.alias, x)]),
        res,
      );
    }

    const external = nested.inferred;
    for (const item of operator.schemaSet) {
      if (!res.schemaSet.has(item) && item[0] !== allAttrs) {
        external.add(item);
      }
    }

    if (
      operator.parent instanceof plan.MapToItem &&
      operator.parent.parent instanceof plan.Calculation
    ) {
      // was child of a calculation
      operator.parent.parent.replaceChild(operator, res);
    }
    const schemaLinked =
      operator.parent instanceof PlanTupleOperator &&
      operator.schema === operator.parent.schema;
    operator.parent.replaceChild(operator, res);
    if (nested.plan instanceof PlanTupleOperator && schemaLinked) {
      linkSchemaToParent(res);
    }
    return external;
  }
  visitIndexedRecursion(operator: plan.IndexedRecursion, ctx: IdSet): IdSet {
    const extra = difference(operator.schemaSet, operator.mapping.schemaSet);
    extra.delete([allAttrs]);
    operator.mapping.addToSchema(extra);
    // this might modify operator.schema if the mapping is a langswitch
    const horizontal = operator.mapping.accept(
      this.vmap,
      union(ctx, operator.source.schema, extra),
    );
    operator.addToSchema(horizontal);
    operator.addToSchema(extra);
    const vertical = operator.source.accept(this.vmap, ctx);
    return vertical;
  }
}
