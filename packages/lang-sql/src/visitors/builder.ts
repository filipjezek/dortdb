import {
  ASTLiteral,
  ASTOperator,
  ASTFunction,
  ASTIdentifier,
  PlanOperator,
  LangSwitch,
  Aliased,
  ASTNode,
  UnsupportedError,
  allAttrs,
  CalculationParams,
  PlanVisitor,
  OpOrId,
  PlanTupleOperator,
  LogicalPlanBuilder,
  IdSet,
  toInfer,
  DortDBAsFriend,
  EqualityChecker,
  AttributeRenamer,
} from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import * as AST from '../ast/index.js';
import { SQLVisitor } from '../ast/visitor.js';
import { ASTDeterministicStringifier } from './ast-stringifier.js';
import { SchemaInferrer } from './schema-inferrer.js';
import { Using } from '../plan/using.js';
import { LangSwitch as PlanLangSwitch } from '../plan/langswitch.js';
import {
  assertCalcLiteral,
  exprToSelection,
  getAggregates,
  intermediateToCalc,
  overrideSource,
  schemaToTrie,
} from '@dortdb/core/utils';
import { ret1, retI0 } from '@dortdb/core/internal-fns';
import { inOp } from '../operators/basic.js';
import { Trie } from '@dortdb/core/data-structures';
import { ilike, like } from '../operators/string.js';
import { likeToRegex } from '../utils/string.js';

export const defaultCol = toId('value');
export const nonlocalPrefix = 'nonlocal';

function toId(id: string | symbol): ASTIdentifier {
  return AST.SQLIdentifier.fromParts([id]);
}
function idToPair(id: ASTIdentifier): [string, string] {
  return [id.parts.at(-1) as string, id.parts.at(-2) as string];
}
function attrToOpArg(
  x: [OpOrId, ASTIdentifier],
): plan.PlanOpAsArg | ASTIdentifier {
  return x[0] instanceof ASTIdentifier ? x[0] : { op: x[0] };
}
function toTuples(op: PlanOperator): PlanTupleOperator {
  return op instanceof PlanTupleOperator
    ? op
    : new plan.MapFromItem('sql', defaultCol, op);
}

export class SQLLogicalPlanBuilder
  implements SQLVisitor<PlanOperator>, LogicalPlanBuilder
{
  protected stringifier = new ASTDeterministicStringifier();
  protected inferrerMap: Record<string, SchemaInferrer> = {};
  protected calcBuilders: Record<string, PlanVisitor<CalculationParams>>;
  protected eqCheckers: Record<string, EqualityChecker>;
  protected renamers: Record<string, AttributeRenamer>;

  constructor(protected db: DortDBAsFriend) {
    this.calcBuilders = db.langMgr.getVisitorMap('calculationBuilder');
    this.eqCheckers = db.langMgr.getVisitorMap('equalityChecker');
    this.renamers = db.langMgr.getVisitorMap('attributeRenamer');
    this.inferrerMap['sql'] = new SchemaInferrer(this.inferrerMap, db);

    this.processNode = this.processNode.bind(this);
    this.processAttr = this.processAttr.bind(this);
    this.processFnArg = this.processFnArg.bind(this);
    this.toCalc = this.toCalc.bind(this);
    this.processOrderItem = this.processOrderItem.bind(this);
  }

  buildPlan(node: ASTNode, ctx: IdSet) {
    const [plan, inferred] = this.inferrerMap['sql'].inferSchema(
      node.accept(this),
      ctx,
    );
    const nonlocal: plan.RenameMap = new Trie();
    for (const key of inferred.keys([nonlocalPrefix])) {
      nonlocal.set(key, key.slice(1));
    }
    if (nonlocal.size) {
      this.renamers['sql'].rename(plan, nonlocal);
    }
    return { plan, inferred };
  }

  protected processNode(item: ASTNode): OpOrId {
    return item instanceof ASTIdentifier ? item : item.accept(this);
  }
  protected processFnArg(item: ASTNode): plan.PlanOpAsArg | ASTIdentifier {
    return item instanceof ASTIdentifier ? item : { op: item.accept(this) };
  }
  protected toCalc(node: ASTNode): plan.Calculation | ASTIdentifier {
    if (node instanceof ASTIdentifier) return node;
    const intermediate = node.accept(this);
    if (intermediate instanceof plan.AggregateCall)
      return intermediate.fieldName;
    return intermediateToCalc(intermediate, this.calcBuilders, this.eqCheckers);
  }

  visitStringLiteral(node: AST.ASTStringLiteral): PlanOperator {
    return new plan.Literal('sql', node.value);
  }
  visitNumberLiteral(node: AST.ASTNumberLiteral): PlanOperator {
    return new plan.Literal('sql', node.value);
  }
  visitArray(node: AST.ASTArray): PlanOperator {
    if (Array.isArray(node.items)) {
      return new plan.FnCall(
        'sql',
        node.items.map(this.processFnArg),
        Array.of,
      );
    }
    return new plan.FnCall(
      'sql',
      [{ op: node.items.accept(this), acceptSequence: true }],
      ret1,
    );
  }
  visitTuple(node: AST.ASTTuple): PlanOperator {
    return new plan.FnCall(
      'sql',
      node.items.map(this.processFnArg),
      Array.of,
      true,
    );
  }
  visitRow(node: AST.ASTRow): PlanOperator {
    if (node.items instanceof ASTIdentifier) {
      return new plan.FnCall('sql', [node.items], ret1);
    }
    const attrs = node.items.map(this.processAttr);
    return new plan.FnCall('sql', attrs.map(attrToOpArg), (...args) => {
      const res: Record<string | symbol, unknown> = {};
      for (let i = 0; i < args.length; i++) {
        res[attrs[i][1].parts[0]] = args[i];
      }
      return res;
    });
  }
  visitCast(node: AST.ASTCast): PlanOperator {
    const impl = this.db.langMgr.getCast('sql', ...idToPair(node.type));
    return new plan.FnCall(
      'sql',
      [{ op: node.expr.accept(this) }],
      node.isArray
        ? (x) =>
            Array.isArray(x) ? x.map(impl.convert) : Array.from(x, impl.convert)
        : impl.convert,
      !node.isArray && impl.pure,
    );
  }
  visitSubscript(node: AST.ASTSubscript): PlanOperator {
    const expr = this.processFnArg(node.expr);
    const index = this.processFnArg(node.from);
    return node.to
      ? new plan.FnCall(
          'sql',
          [expr, index, this.processFnArg(node.to)],
          (e, f, t) => e.slice(f, t),
        )
      : new plan.FnCall('sql', [expr, index], (e, i) => e[i], true);
  }
  visitExists(node: AST.ASTExists): PlanOperator {
    let res = node.query.accept(this) as PlanOperator;
    res = new plan.Limit('sql', 0, 1, res);
    const col = toId('count');
    res = new plan.GroupBy(
      'sql',
      [],
      [
        new plan.AggregateCall(
          'sql',
          [toId(allAttrs)],
          this.db.langMgr.getAggr('sql', 'count'),
          col,
        ),
      ],
      res as plan.Limit,
    );
    res = new plan.MapToItem('sql', col, res as plan.GroupBy);
    return new plan.FnCall('sql', [{ op: res }], ret1);
  }

  visitQuantifier(node: AST.ASTQuantifier): PlanOperator {
    let query = node.query.accept(this) as PlanTupleOperator;
    if (query.schema.length !== 1)
      throw new Error('Quantified subquery must return exactly one column');
    const col = query.schema[0];
    let agg: string;
    switch (node.parentOp) {
      case '>':
      case '>=':
        agg = node.quantifier === plan.QuantifierType.ALL ? 'max' : 'min';
        break;
      case '<':
      case '<=':
        agg = node.quantifier === plan.QuantifierType.ALL ? 'min' : 'max';
        break;
    }
    if (agg) {
      query = new plan.GroupBy(
        'sql',
        [],
        [
          new plan.AggregateCall(
            'sql',
            [col],
            this.db.langMgr.getAggr('sql', agg),
            col,
          ),
        ],
        query as PlanTupleOperator,
      );
      return new plan.FnCall(
        'sql',
        [{ op: new plan.MapToItem('sql', col, query) }],
        ret1,
      );
    }

    return new plan.Quantifier('sql', node.quantifier, query);
  }
  visitIdentifier(node: ASTIdentifier): PlanOperator {
    return new plan.FnCall('sql', [node], ret1, true);
  }
  visitSQLIdentifier(node: AST.SQLIdentifier): PlanOperator {
    return this.visitIdentifier(node);
  }
  visitTableAlias(node: AST.ASTTableAlias): PlanTupleOperator {
    let src: PlanTupleOperator;
    if (node.table instanceof ASTIdentifier) {
      src = new plan.TupleSource('sql', node.table);
      src.addToSchema(ASTIdentifier.fromParts([...node.table.parts, toInfer]));
    } else {
      src = toTuples(node.table.accept(this));
    }
    if (node.columns?.length) {
      if (node.columns.length !== src.schema?.length)
        throw new Error(
          `Column count mismatch: ${
            node.nameOriginal
          }(${node.columnsOriginal.join(', ')}) as opposed to (${src.schema
            ?.map((x) => x.parts.join('.'))
            .join(', ')})`,
        );
      return new plan.Projection(
        'sql',
        node.columns.map((x, i) => [
          src.schema[i],
          AST.SQLIdentifier.fromParts([node.name, x]),
        ]),
        src,
      );
    }
    if (src instanceof plan.TupleFnSource) {
      const n = ASTIdentifier.fromParts([node.name]);
      src.removeFromSchema(
        src.schema.filter((x) => x.parts.at(-1) === toInfer),
      );
      src.addToSchema(ASTIdentifier.fromParts([...n.parts, toInfer]));
      src.name = src.name ? [src.name as ASTIdentifier, n] : n;
      return src;
    }
    if (src instanceof plan.TupleSource) {
      src.name = [
        src.name as ASTIdentifier,
        ASTIdentifier.fromParts([node.name]),
      ];
      src.removeFromSchema(
        src.schema.filter((x) => x.parts.at(-1) === toInfer),
      );
      src.addToSchema(ASTIdentifier.fromParts([node.name, toInfer]));
      return src;
    }
    if (src instanceof PlanLangSwitch) {
      src.alias = node.name;
      return src;
    }
    return new plan.Projection(
      'sql',
      src.schema.map((x) => [x, overrideSource(node.name, x)]),
      src,
    );
  }
  visitExpressionAlias(node: AST.ASTExpressionAlias): PlanOperator {
    throw new Error('Method not implemented.');
  }

  protected processOrderItem(item: AST.OrderByItem): plan.Order {
    return {
      ascending: item.ascending,
      key: this.toCalc(item.expression),
      nullsFirst: item.nullsFirst,
    };
  }
  visitSelectStatement(node: AST.SelectStatement) {
    if (node.withQueries?.length)
      throw new UnsupportedError('With queries not supported');

    const orders = node.orderBy ? node.orderBy.map(this.processOrderItem) : [];
    const aggs = getAggregates(orders.map(plan.getKey));
    let op: PlanTupleOperator;
    if (node.selectSet instanceof AST.SelectSet && !node.selectSet.setOp) {
      op = this.visitSelectSet(node.selectSet, null, aggs);
    } else {
      op = node.selectSet.accept(this) as PlanTupleOperator;
    }
    if (orders.length) {
      op = new plan.OrderBy('sql', orders, op);
    }
    if (node.limit || node.offset) {
      op = this.buildLimit(node, op);
    }
    return op;
  }
  protected buildLimit(node: AST.SelectStatement, op: PlanTupleOperator) {
    const limit = node.limit && this.toCalc(node.limit);
    const offset = node.offset && this.toCalc(node.offset);
    if (limit && !assertCalcLiteral(limit, 'number'))
      throw new Error('Limit must be a number constant');
    if (offset && !assertCalcLiteral(offset, 'number'))
      throw new Error('Offset must be a number constant');
    return new plan.Limit(
      'sql',
      offset ? (offset as plan.Calculation).impl() : 0,
      limit ? (limit as plan.Calculation).impl() : Infinity,
      op,
    );
  }

  /**
   * should be called only by {@link SQLLogicalPlanBuilder#visitSelectSet},
   * which provides the `left` arg
   */
  visitSelectSetOp(
    node: AST.SelectSetOp,
    left: PlanTupleOperator = null,
  ): PlanTupleOperator {
    let next = node.next.accept(this) as PlanTupleOperator;
    switch (node.type) {
      case AST.SelectSetOpType.UNION:
        next = new plan.Union('sql', left, next);
        break;
      case AST.SelectSetOpType.INTERSECT:
        next = new plan.Intersection('sql', left, next);
        break;
      case AST.SelectSetOpType.EXCEPT:
        next = new plan.Difference('sql', left, next);
        break;
    }
    if (node.distinct) {
      next = new plan.Distinct('sql', allAttrs, next);
    }
    return next;
  }

  /**
   * @param _ only for compliance with {@link PlanVisitor}
   */
  visitSelectSet(
    node: AST.SelectSet,
    _?: unknown,
    orderByAggs?: plan.AggregateCall[],
  ): PlanTupleOperator {
    let op = node.from
      ? this.getTableName(node.from)[0]
      : new plan.NullSource('sql');
    const items = node.items.map(this.processAttr);
    const aggregates = getAggregates(items.map(retI0));
    const aggFields = schemaToTrie(aggregates.map((x) => x.fieldName));
    if (node.windows) {
      throw new UnsupportedError('Window functions not supported');
    }
    if (node.where) {
      op = exprToSelection(
        this.processNode(node.where),
        op,
        this.calcBuilders,
        this.eqCheckers,
        'sql',
      );
    }

    const havingCond = node.having ? this.processNode(node.having) : null;
    if (havingCond && !(havingCond instanceof ASTIdentifier)) {
      const tempParams = havingCond.accept(this.calcBuilders);
      for (const agg of tempParams.aggregates ?? []) {
        if (!aggFields.has(agg.fieldName.parts)) {
          aggregates.push(agg.clone());
          aggFields.add(agg.fieldName.parts);
        }
      }
    }
    for (const agg of orderByAggs || []) {
      if (!aggFields.has(agg.fieldName.parts)) {
        aggregates.push(agg);
        aggFields.add(agg.fieldName.parts);
      }
    }

    if (aggregates.length) {
      op = this.visitGroupByClause(node.groupBy, op, aggregates);
    }
    if (node.having) {
      op = exprToSelection(
        havingCond,
        op,
        this.calcBuilders,
        this.eqCheckers,
        'sql',
      );
    }
    op = new plan.Projection('sql', items, op);
    if (node.distinct) {
      op = new plan.Distinct(
        'sql',
        node.distinct === true ? allAttrs : node.distinct.map(this.toCalc),
        op,
      );
    }
    if (node.setOp) {
      op = this.visitSelectSetOp(node.setOp, op);
    }
    return op;
  }

  protected processAttr(
    attr: ASTNode,
  ): Aliased<ASTIdentifier | plan.Calculation> {
    if (attr instanceof AST.SQLIdentifier) {
      return [attr, attr];
    }
    if (attr instanceof AST.ASTExpressionAlias) {
      const alias = toId(attr.alias);
      if (attr.expression instanceof AST.SQLIdentifier) {
        return [attr.expression, alias];
      }
      return [this.toCalc(attr.expression), alias];
    }
    const alias = toId(attr.accept(this.stringifier));
    return [this.toCalc(attr), alias];
  }

  /**
   * should be called only by {@link SQLLogicalPlanBuilder#visitSelectSet},
   * which provides the `src` and `aggregates` args
   */
  visitGroupByClause(
    node: AST.GroupByClause,
    src: PlanTupleOperator = null,
    aggregates: plan.AggregateCall[] = [],
  ): PlanTupleOperator {
    let attrs: Aliased<ASTIdentifier | plan.Calculation>[] = [];
    if (node) {
      if (node.type !== AST.GroupByType.BASIC)
        throw new UnsupportedError(
          `Group by type "${node.type}" not supported`,
        );
      attrs = (node.items as ASTNode[]).map(this.processAttr);
    }
    for (const aggr of aggregates) {
      const schemaToReplace = aggr.postGroupSource.schema;
      for (
        let step = aggr.postGroupSource.parent as PlanTupleOperator;
        step?.schema === schemaToReplace;
        step = step.parent as PlanTupleOperator
      ) {
        step.schema = src.schema;
        step.schemaSet = src.schemaSet;
      }
    }
    const res = new plan.GroupBy('sql', attrs, aggregates, src);
    for (const aggr of res.aggs) {
      aggr.postGroupSource.schema = res.source.schema;
      aggr.postGroupSource.schemaSet = res.source.schemaSet;
    }
    return res;
  }

  protected getTableName(
    node: ASTIdentifier | AST.ASTTableAlias | AST.JoinClause,
  ): [PlanTupleOperator, ASTIdentifier] {
    if (node instanceof ASTIdentifier) {
      const src = new plan.TupleSource('sql', node);
      src.addToSchema(ASTIdentifier.fromParts([...node.parts, toInfer]));
      return [src, node];
    }
    const src = node.accept(this) as PlanTupleOperator;
    if (node instanceof AST.JoinClause) return [src, null];
    const name = node.name && toId(node.name);
    return [src, name];
  }
  visitJoinClause(node: AST.JoinClause): PlanTupleOperator {
    if (node.natural) throw new UnsupportedError('Natural joins not supported');
    const [left, leftName] = this.getTableName(node.tableLeft);
    const [right, rightName] = this.getTableName(node.tableRight);

    let op: PlanTupleOperator;
    if (
      [AST.JoinType.LEFT, AST.JoinType.RIGHT, AST.JoinType.FULL].includes(
        node.joinType,
      )
    ) {
      op = new plan.Join(
        'sql',
        left,
        right,
        node.condition ? [this.toCalc(node.condition) as plan.Calculation] : [],
      );
      (op as plan.Join).leftOuter =
        node.joinType === AST.JoinType.LEFT ||
        node.joinType === AST.JoinType.FULL;
      (op as plan.Join).rightOuter =
        node.joinType === AST.JoinType.RIGHT ||
        node.joinType === AST.JoinType.FULL;
    } else {
      op = node.lateral ? right : new plan.CartesianProduct('sql', left, right);
      if (node.condition) {
        op = exprToSelection(
          this.processNode(node.condition),
          op,
          this.calcBuilders,
          this.eqCheckers,
          'sql',
        );
      }
    }

    if (node.using) {
      if (!leftName)
        throw new Error('Using can be only used with two named relations');

      op = new Using(
        'sql',
        node.using,
        leftName,
        rightName,
        op as plan.CartesianProduct | plan.Join,
      );
    }

    if (node.lateral) {
      op = new plan.ProjectionConcat('sql', op, false, left);
    }
    return op;
  }
  visitCase(node: AST.ASTCase): PlanOperator {
    return new plan.Conditional(
      'sql',
      node.expr && this.processNode(node.expr),
      node.whenThen.map(([w, t]) => [this.processNode(w), this.processNode(t)]),
      node.elseExpr && this.processNode(node.elseExpr),
    );
  }
  visitValues(node: AST.ValuesClause): PlanOperator {
    const calcs = node.values.map((x) => x.map(this.toCalc));
    const external = calcs.flatMap((x) =>
      x.filter((x) => x instanceof ASTIdentifier || x.args.length > 0),
    );

    const res = new plan.TupleFnSource('sql', external, function* (...args) {
      let argI = 0;
      for (let i = 0; i < calcs.length; i++) {
        const res: Record<string, unknown> = {};
        for (let j = 0; j < calcs[i].length; j++) {
          const calc = calcs[i][j];
          res['col' + j] =
            calc instanceof ASTIdentifier
              ? args[argI++]
              : calc.impl(...args.slice(argI, (argI += calc.args.length)));
        }
        yield res;
      }
    });
    res.schema = calcs[0].map((_, i) => toId('col' + i));
    return res;
  }
  visitAggregate(node: AST.ASTAggregate): PlanOperator {
    const impl = this.db.langMgr.getAggr(node.lang, ...idToPair(node.id));
    if (node.withinGroupArgs)
      throw new UnsupportedError('Within group not supported');
    const res = new plan.AggregateCall(
      node.lang,
      node.args.map(this.toCalc),
      impl,
      toId(this.stringifier.visitAggregate(node)),
    );

    if (node.filter) {
      res.postGroupOp = new plan.Selection(
        'sql',
        this.toCalc(node.filter),
        res.postGroupOp,
      );
    }
    if (node.distinct) {
      res.postGroupOp = new plan.Distinct('sql', res.args, res.postGroupOp);
    }
    if (node.orderBy) {
      res.postGroupOp = new plan.OrderBy(
        'sql',
        node.orderBy.map((x) => ({
          ascending: x.ascending,
          nullsFirst: x.nullsFirst,
          key: this.toCalc(x.expression),
        })),
        res.postGroupOp,
      );
    }
    return res;
  }
  visitWindowSpec(node: AST.WindowSpec): PlanOperator {
    throw new UnsupportedError('Window functions not supported');
  }
  visitWindowFn(node: AST.ASTWindowFn): PlanOperator {
    throw new UnsupportedError('Window functions not supported');
  }
  visitTableFn(node: AST.TableFn): PlanOperator {
    const impl = this.db.langMgr.getFn(node.lang, ...idToPair(node.id));
    let res: PlanTupleOperator = new plan.TupleFnSource(
      'sql',
      node.args.map(this.toCalc),
      impl.impl,
      node.id,
    );
    res.addToSchema(ASTIdentifier.fromParts([...node.id.parts, toInfer]));
    if (impl.outputSchema) {
      res.addToSchema(impl.outputSchema);
    }
    if (node.withOrdinality)
      res = new plan.ProjectionIndex('sql', toId('ordinality'), res);
    return res;
  }
  visitRowsFrom(node: AST.RowsFrom): PlanOperator {
    throw new UnsupportedError('Rows from not supported.');
  }
  visitWithQuery(node: AST.WithQuery): PlanOperator {
    throw new UnsupportedError('With queries not supported');
  }
  visitLiteral<U>(node: ASTLiteral<U>): PlanOperator {
    return new plan.Literal('sql', node.value);
  }
  visitOperator(node: ASTOperator): PlanOperator {
    const result = new plan.FnCall(
      node.lang,
      node.operands.map(this.processFnArg), // identifiers should be processed into FnCalls, so that we can set pure=true without concerns
      this.db.langMgr.getOp(node.lang, ...idToPair(node.id)).impl,
      true,
    );
    if (result.impl === inOp.impl && 'op' in result.args[1]) {
      result.args[1].acceptSequence = true;
    } else if (result.impl === like.impl || result.impl === ilike.impl) {
      // possibly precompute the regex for LIKE/ILIKE
      result.args[1] = {
        op: new plan.FnCall(
          'sql',
          [
            result.args[1],
            { op: new plan.Literal('sql', result.impl === like.impl) },
          ],
          likeToRegex,
          true,
        ),
      };
    }
    return result;
  }
  visitFunction(node: ASTFunction): PlanOperator {
    const [id, schema] = idToPair(node.id);
    const impl = this.db.langMgr.getFnOrAggr('sql', id, schema);

    if ('init' in impl) {
      // refers to an aggregate function result, which will be computed by the groupby operator
      return new plan.AggregateCall(
        node.lang,
        node.args.map(this.toCalc),
        impl,
        toId(this.stringifier.visitFunction(node)),
      );
    }
    return new plan.FnCall(
      node.lang,
      node.args.map(this.processFnArg),
      impl.impl,
      impl.pure,
    );
  }
  visitLangSwitch(node: LangSwitch): PlanOperator {
    return new PlanLangSwitch('sql', node);
  }
}
