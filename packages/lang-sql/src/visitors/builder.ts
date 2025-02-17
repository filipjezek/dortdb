import {
  ASTLiteral,
  ASTOperator,
  ASTFunction,
  ASTIdentifier,
  LogicalPlanOperator,
  LangSwitch,
  LanguageManager,
  Aliased,
  ASTNode,
  UnsupportedError,
  allAttrs,
  CalculationParams,
  LogicalPlanVisitor,
  LogicalOpOrId,
  LogicalPlanTupleOperator,
  LogicalPlanBuilder,
  boundParam,
} from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import * as AST from '../ast/index.js';
import { SQLVisitor } from '../ast/visitor.js';
import { ASTDeterministicStringifier } from './ast-stringifier.js';
import { SchemaInferrer } from './schema-inferrer.js';
import { Using } from '../plan/using.js';
import {
  assertCalcLiteral,
  overrideSource,
  schemaToTrie,
} from '@dortdb/core/utils';
import { ret1, retI1 } from '@dortdb/core/internal-fns';

function toId(id: string | symbol): ASTIdentifier {
  return AST.SQLIdentifier.fromParts([id]);
}
function getAggrs([item]: Aliased<
  plan.Calculation | ASTIdentifier
>): plan.AggregateCall[] {
  return item instanceof plan.Calculation ? (item.aggregates ?? []) : [];
}
function idToPair(id: ASTIdentifier): [string, string] {
  return [
    id.parts[id.parts.length - 1] as string,
    id.parts[id.parts.length - 2] as string,
  ];
}
function attrToOpArg(
  x: [LogicalOpOrId, ASTIdentifier],
): plan.PlanOpAsArg | ASTIdentifier {
  return x[0] instanceof ASTIdentifier ? x[0] : { op: x[0] };
}
function toTuples(op: LogicalPlanOperator): LogicalPlanTupleOperator {
  return op instanceof LogicalPlanTupleOperator
    ? op
    : new plan.MapFromItem('sql', toId('item'), op);
}

export class SQLLogicalPlanBuilder
  implements SQLVisitor<LogicalPlanOperator>, LogicalPlanBuilder
{
  private stringifier = new ASTDeterministicStringifier();
  private inferrerMap: Record<string, SchemaInferrer> = {};
  private calcBuilders: Record<string, LogicalPlanVisitor<CalculationParams>>;

  constructor(private langMgr: LanguageManager) {
    this.calcBuilders = langMgr.getVisitorMap('calculationBuilder');
    this.inferrerMap['sql'] = new SchemaInferrer(this.inferrerMap, langMgr);

    this.processNode = this.processNode.bind(this);
    this.processAttr = this.processAttr.bind(this);
    this.processFnArg = this.processFnArg.bind(this);
    this.toCalc = this.toCalc.bind(this);
    this.processOrderItem = this.processOrderItem.bind(this);
  }

  buildPlan(node: ASTNode): LogicalPlanOperator {
    const plan = node.accept(this);
    plan.accept(this.inferrerMap);
    return plan;
  }

  private processNode(item: ASTNode): LogicalOpOrId {
    return item instanceof ASTIdentifier ? item : item.accept(this);
  }
  private processFnArg(item: ASTNode): plan.PlanOpAsArg | ASTIdentifier {
    return item instanceof ASTIdentifier ? item : { op: item.accept(this) };
  }
  private toCalc(node: ASTNode): plan.Calculation | ASTIdentifier {
    if (node instanceof ASTIdentifier) return node;
    const calcParams = node.accept(this).accept(this.calcBuilders);
    return new plan.Calculation(
      'sql',
      calcParams.impl,
      calcParams.args,
      calcParams.aggregates,
      calcParams.literal,
    );
  }

  visitStringLiteral(node: AST.ASTStringLiteral): LogicalPlanOperator {
    return new plan.Literal('sql', node.value);
  }
  visitNumberLiteral(node: AST.ASTNumberLiteral): LogicalPlanOperator {
    return new plan.Literal('sql', node.value);
  }
  visitArray(node: AST.ASTArray): LogicalPlanOperator {
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
      Array.from,
    );
  }
  visitRow(node: AST.ASTRow): LogicalPlanOperator {
    const attrs = node.items.map(this.processAttr);
    return new plan.FnCall('sql', attrs.map(attrToOpArg), (...args) => {
      const res: Record<string | symbol, any> = {};
      for (let i = 0; i < args.length; i++) {
        res[attrs[i][1].parts[0]] = args[i];
      }
      return res;
    });
  }
  visitParam(node: AST.ASTParam): LogicalPlanOperator {
    return new plan.FnCall(
      'sql',
      [AST.SQLIdentifier.fromParts([boundParam, node.name])],
      ret1,
      true,
    );
  }
  visitCast(node: AST.ASTCast): LogicalPlanOperator {
    const impl = this.langMgr.getCast('sql', ...idToPair(node.type));
    return new plan.FnCall(
      'sql',
      [{ op: node.expr.accept(this) }],
      node.isArray
        ? (x) => {
            Array.isArray(x)
              ? x.map(impl.convert)
              : Array.from(x).map(impl.convert);
          }
        : impl.convert,
      !node.isArray && impl.pure,
    );
  }
  visitSubscript(node: AST.ASTSubscript): LogicalPlanOperator {
    const expr = { op: node.expr.accept(this) };
    const index = { op: node.from.accept(this) };
    return node.to
      ? new plan.FnCall(
          'sql',
          [expr, index, { op: node.to.accept(this) }],
          (e, f, t) => e.slice(f, t),
        )
      : new plan.FnCall('sql', [expr, index], (e, i) => e[i], true);
  }
  visitExists(node: AST.ASTExists): LogicalPlanOperator {
    let res = node.query.accept(this) as LogicalPlanOperator;
    res = new plan.Limit('sql', 0, 1, res);
    const col = toId('count');
    res = new plan.GroupBy(
      'sql',
      [],
      [
        new plan.AggregateCall(
          'sql',
          [toId(allAttrs)],
          this.langMgr.getAggr('sql', 'count'),
          col,
        ),
      ],
      res as plan.Limit,
    );
    res = new plan.MapToItem('sql', col, res as plan.GroupBy);
    return new plan.FnCall('sql', [{ op: res }], ret1);
  }

  visitQuantifier(node: AST.ASTQuantifier): LogicalPlanOperator {
    let query = node.query.accept(this) as LogicalPlanTupleOperator;
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
            this.langMgr.getAggr('sql', agg),
            col,
          ),
        ],
        query as LogicalPlanTupleOperator,
      );
      return new plan.FnCall(
        'sql',
        [{ op: new plan.MapToItem('sql', col, query) }],
        ret1,
      );
    }

    return new plan.Quantifier('sql', node.quantifier, query);
  }
  visitIdentifier(node: ASTIdentifier): LogicalPlanOperator {
    return new plan.FnCall('sql', [node], ret1, true);
  }
  visitSQLIdentifier(node: AST.SQLIdentifier): LogicalPlanOperator {
    return this.visitIdentifier(node);
  }
  visitTableAlias(node: AST.ASTTableAlias): LogicalPlanTupleOperator {
    const src =
      node.table instanceof ASTIdentifier
        ? new plan.TupleSource('sql', node.table)
        : toTuples(node.table.accept(this));
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
      src.name = src.name ? [src.name as ASTIdentifier, n] : n;
      return src;
    }
    if (src instanceof plan.TupleSource) {
      src.name = [
        src.name as ASTIdentifier,
        ASTIdentifier.fromParts([node.name]),
      ];
      return src;
    }
    return new plan.Projection(
      'sql',
      src.schema.map((x) => [x, overrideSource(node.name, x)]),
      src,
    );
  }
  visitExpressionAlias(node: AST.ASTExpressionAlias): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }

  private processOrderItem(x: AST.OrderByItem): plan.Order {
    return {
      ascending: x.ascending,
      key: this.toCalc(x.expression),
      nullsFirst: x.nullsFirst,
    };
  }
  private processOrderBy(
    op: LogicalPlanTupleOperator,
    node: AST.SelectStatement,
  ): LogicalPlanTupleOperator {
    const orderItems = node.orderBy.map(this.processOrderItem);
    let proj = op instanceof plan.Distinct ? op.source : op;
    op = new plan.OrderBy('sql', orderItems, op);
    if (proj instanceof plan.Projection) {
      // otherwise it's a set op
      op = new plan.Projection('sql', proj.attrs.slice(), op);
      for (const oitem of orderItems) {
        if (
          oitem.key instanceof ASTIdentifier &&
          !proj.schemaSet.has(oitem.key.parts)
        ) {
          proj.addToSchema(oitem.key);
          proj.attrs.push([oitem.key, oitem.key]);
        } else if (oitem.key instanceof plan.Calculation) {
          for (const attr of this.inferrerMap['sql'].visitCalculation(
            oitem.key,
          )) {
            if (!proj.schemaSet.has(attr)) {
              const id = ASTIdentifier.fromParts(attr);
              proj.addToSchema(id);
              proj.attrs.push([id, id]);
            }
          }
        }
      }
    }
    return op;
  }
  visitSelectStatement(node: AST.SelectStatement) {
    if (node.withQueries?.length)
      throw new UnsupportedError('With queries not supported');
    let op = node.selectSet.accept(this) as LogicalPlanTupleOperator;
    if (node.orderBy?.length) {
      op = this.processOrderBy(op, node);
    }
    if (node.limit || node.offset) {
      op = this.buildLimit(node, op);
    }
    return op;
  }
  private buildLimit(node: AST.SelectStatement, op: LogicalPlanTupleOperator) {
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
   * which provides the `src` arg
   */
  visitSelectSetOp(
    node: AST.SelectSetOp,
    left: LogicalPlanTupleOperator = null,
  ): LogicalPlanTupleOperator {
    let next = node.next.accept(this) as LogicalPlanTupleOperator;
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

  visitSelectSet(node: AST.SelectSet): LogicalPlanTupleOperator {
    let op = node.from
      ? this.getTableName(node.from)[0]
      : new plan.NullSource('sql');
    const items = node.items.map(this.processAttr);
    const aggregates = items.flatMap(getAggrs);
    if (node.windows) {
      throw new UnsupportedError('Window functions not supported');
    }
    if (node.where) {
      op = new plan.Selection('sql', this.toCalc(node.where), op);
    }
    if (aggregates.length) {
      op = this.visitGroupByClause(node.groupBy, op, aggregates);
    }
    if (node.having) {
      op = new plan.Selection('sql', this.toCalc(node.having), op);
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

  private processAttr(
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
    src: LogicalPlanTupleOperator = null,
    aggregates: plan.AggregateCall[] = [],
  ): LogicalPlanTupleOperator {
    let attrs: Aliased<ASTIdentifier | plan.Calculation>[] = [];
    if (node) {
      if (node.type !== AST.GroupByType.BASIC)
        throw new UnsupportedError(
          `Group by type "${node.type}" not supported`,
        );
      attrs = (node.items as ASTNode[]).map(this.processAttr);
    }
    const res = new plan.GroupBy('sql', attrs, aggregates, src);
    for (const aggr of aggregates) {
      const schemaToReplace = aggr.postGroupSource.schema;
      for (
        let step = aggr.postGroupSource;
        step?.schema === schemaToReplace;
        step = step.parent as LogicalPlanTupleOperator
      ) {
        step.schema = src.schema;
        step.schemaSet = src.schemaSet;
      }
    }
    return res;
  }

  private getTableName(
    node: ASTIdentifier | AST.ASTTableAlias | AST.JoinClause,
  ): [LogicalPlanTupleOperator, ASTIdentifier] {
    const src =
      node instanceof ASTIdentifier
        ? new plan.TupleSource('sql', node)
        : (node.accept(this) as LogicalPlanTupleOperator);
    if (node instanceof AST.JoinClause) return [src, null];
    const name =
      node instanceof ASTIdentifier ? node : node.name && toId(node.name);
    return [src, name];
  }
  visitJoinClause(node: AST.JoinClause): LogicalPlanTupleOperator {
    if (node.natural) throw new UnsupportedError('Natural joins not supported');
    if (node.lateral) throw new UnsupportedError('Lateral joins not supported');
    const [left, leftName] = this.getTableName(node.tableLeft);
    const [right, rightName] = this.getTableName(node.tableRight);

    // TODO: implement outer join types
    let op: LogicalPlanTupleOperator = new plan.CartesianProduct(
      'sql',
      left,
      right,
    );

    if (node.condition) {
      op = new plan.Selection('sql', this.toCalc(node.condition), op);
    } else if (node.using) {
      if (!leftName)
        throw new Error('Using can be only used with two named relations');

      op = new Using(
        'sql',
        node.using,
        leftName,
        rightName,
        op as plan.CartesianProduct,
      );
    }
    return op;
  }
  visitCase(node: AST.ASTCase): LogicalPlanOperator {
    return new plan.Conditional(
      'sql',
      node.expr && this.processNode(node.expr),
      node.whenThen.map(([w, t]) => [this.processNode(w), this.processNode(t)]),
      node.elseExpr && this.processNode(node.elseExpr),
    );
  }
  visitValues(node: AST.ValuesClause): LogicalPlanOperator {
    const calcs = node.values.map((x) => x.map(this.toCalc));
    const external = calcs.flatMap((x) =>
      x.filter((x) => x instanceof ASTIdentifier || x.args.length > 0),
    );

    const res = new plan.TupleFnSource('sql', external, function* (...args) {
      let argI = 0;
      for (let i = 0; i < calcs.length; i++) {
        const res: Record<string, any> = {};
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
  visitAggregate(node: AST.ASTAggregate): LogicalPlanOperator {
    const impl = this.langMgr.getAggr(node.lang, ...idToPair(node.id));
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
        node.orderBy.map(this.processOrderItem),
        res.postGroupOp,
      );
    }
    return res;
  }
  visitWindowSpec(node: AST.WindowSpec): LogicalPlanOperator {
    throw new UnsupportedError('Window functions not supported');
  }
  visitWindowFn(node: AST.ASTWindowFn): LogicalPlanOperator {
    throw new UnsupportedError('Window functions not supported');
  }
  visitTableFn(node: AST.TableFn): LogicalPlanOperator {
    const impl = this.langMgr.getFn(node.lang, ...idToPair(node.id));
    let res: LogicalPlanTupleOperator = new plan.TupleFnSource(
      'sql',
      node.args.map(this.toCalc),
      impl.impl,
      node.id,
    );
    if (impl.outputSchema) {
      res.addToSchema(impl.outputSchema);
    }
    if (node.withOrdinality)
      res = new plan.ProjectionIndex('sql', toId('ordinality'), res);
    return res;
  }
  visitRowsFrom(node: AST.RowsFrom): LogicalPlanOperator {
    throw new UnsupportedError('Rows from not supported.');
  }
  visitWithQuery(node: AST.WithQuery): LogicalPlanOperator {
    throw new UnsupportedError('With queries not supported');
  }
  visitLiteral<U>(node: ASTLiteral<U>): LogicalPlanOperator {
    return new plan.Literal('sql', node.value);
  }
  visitOperator(node: ASTOperator): LogicalPlanOperator {
    return new plan.FnCall(
      node.lang,
      node.operands.map((x) => ({ op: x.accept(this) })), // identifiers should be processed into FnCalls, so that we can set pure=true without concerns
      this.langMgr.getOp(node.lang, ...idToPair(node.id)).impl,
      true,
    );
  }
  visitFunction(node: ASTFunction): LogicalPlanOperator {
    const [id, schema] = idToPair(node.id);
    const impl = this.langMgr.getFnOrAggr('sql', id, schema); // throw the error

    if ('init' in impl) {
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
    );
  }
  visitLangSwitch(node: LangSwitch): LogicalPlanOperator {
    const lang = this.langMgr.getLang(node.lang);
    return node.node.accept(new lang.visitors.logicalPlanBuilder(this.langMgr));
  }
}
