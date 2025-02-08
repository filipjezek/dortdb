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
  utils,
  LogicalPlanTupleOperator,
  operators,
  LogicalPlanBuilder,
  boundParam,
} from '@dortdb/core';
import * as AST from '../ast/index.js';
import { SQLVisitor } from '../ast/visitor.js';
import { ASTDeterministicStringifier } from './ast-stringifier.js';
import { SchemaInferrer } from './schema-inferrer.js';

function toId(id: string | symbol): ASTIdentifier {
  return AST.SQLIdentifier.fromParts([id]);
}
function overrideTable(
  name: string | ASTIdentifier,
  attr: ASTIdentifier
): ASTIdentifier {
  return AST.SQLIdentifier.fromParts(
    (name instanceof ASTIdentifier ? name.parts : [name]).concat([
      attr.parts[attr.parts.length - 1],
    ])
  );
}
function ret1<T>(x: T): T {
  return x;
}
function retI1<T>(x: [any, T, ...any]): T {
  return x[1];
}
function getAggrs([item]: Aliased<
  operators.Calculation | ASTIdentifier
>): operators.AggregateCall[] {
  return item instanceof operators.Calculation ? item.aggregates ?? [] : [];
}
function idToPair(id: ASTIdentifier): [string, string] {
  return [
    id.parts[id.parts.length - 1] as string,
    id.parts[id.parts.length - 2] as string,
  ];
}
function attrToOpArg(
  x: [LogicalOpOrId, ASTIdentifier]
): operators.PlanOpAsArg | ASTIdentifier {
  return x[0] instanceof ASTIdentifier ? x[0] : { op: x[0] };
}
function toTuples(op: LogicalPlanOperator): LogicalPlanTupleOperator {
  return op instanceof LogicalPlanTupleOperator
    ? op
    : new operators.MapFromItem('sql', toId('item'), op);
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
  private processFnArg(item: ASTNode): operators.PlanOpAsArg | ASTIdentifier {
    return item instanceof ASTIdentifier ? item : { op: item.accept(this) };
  }
  private toCalc(node: ASTNode): operators.Calculation | ASTIdentifier {
    if (node instanceof ASTIdentifier) return node;
    const calcParams = node.accept(this).accept(this.calcBuilders);
    return new operators.Calculation(
      'sql',
      calcParams.impl,
      calcParams.args,
      calcParams.aggregates,
      calcParams.literal
    );
  }

  visitStringLiteral(node: AST.ASTStringLiteral): LogicalPlanOperator {
    return new operators.Literal('sql', node.value);
  }
  visitNumberLiteral(node: AST.ASTNumberLiteral): LogicalPlanOperator {
    return new operators.Literal('sql', node.value);
  }
  visitArray(node: AST.ASTArray): LogicalPlanOperator {
    if (Array.isArray(node.items)) {
      return new operators.FnCall(
        'sql',
        node.items.map(this.processFnArg),
        Array.of
      );
    }
    return new operators.FnCall(
      'sql',
      [{ op: node.items.accept(this), acceptSequence: true }],
      Array.from
    );
  }
  visitRow(node: AST.ASTRow): LogicalPlanOperator {
    const attrs = node.items.map(this.processAttr);
    return new operators.FnCall('sql', attrs.map(attrToOpArg), (...args) => {
      const res: Record<string | symbol, any> = {};
      for (let i = 0; i < args.length; i++) {
        res[attrs[i][1].parts[0]] = args[i];
      }
      return res;
    });
  }
  visitParam(node: AST.ASTParam): LogicalPlanOperator {
    return new operators.FnCall(
      'sql',
      [AST.SQLIdentifier.fromParts([boundParam, node.name])],
      ret1,
      true
    );
  }
  visitCast(node: AST.ASTCast): LogicalPlanOperator {
    const impl = this.langMgr.getCast('sql', ...idToPair(node.type));
    return new operators.FnCall(
      'sql',
      [{ op: node.expr.accept(this) }],
      node.isArray
        ? (x) => {
            Array.isArray(x)
              ? x.map(impl.convert)
              : Array.from(x).map(impl.convert);
          }
        : impl.convert,
      !node.isArray && impl.pure
    );
  }
  visitSubscript(node: AST.ASTSubscript): LogicalPlanOperator {
    const expr = { op: node.expr.accept(this) };
    const index = { op: node.from.accept(this) };
    return node.to
      ? new operators.FnCall(
          'sql',
          [expr, index, { op: node.to.accept(this) }],
          (e, f, t) => e.slice(f, t)
        )
      : new operators.FnCall('sql', [expr, index], (e, i) => e[i], true);
  }
  visitExists(node: AST.ASTExists): LogicalPlanOperator {
    let res = node.query.accept(this) as LogicalPlanOperator;
    res = new operators.Limit('sql', 0, 1, res);
    const col = toId('count');
    res = new operators.GroupBy(
      'sql',
      [],
      [
        new operators.AggregateCall(
          'sql',
          [toId(allAttrs)],
          this.langMgr.getAggr('sql', 'count'),
          col
        ),
      ],
      res as operators.Limit
    );
    res = new operators.MapToItem('sql', col, res as operators.GroupBy);
    return new operators.FnCall('sql', [{ op: res }], ret1);
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
        agg = node.quantifier === operators.QuantifierType.ALL ? 'max' : 'min';
        break;
      case '<':
      case '<=':
        agg = node.quantifier === operators.QuantifierType.ALL ? 'min' : 'max';
        break;
    }
    if (agg) {
      query = new operators.GroupBy(
        'sql',
        [],
        [
          new operators.AggregateCall(
            'sql',
            [col],
            this.langMgr.getAggr('sql', agg),
            col
          ),
        ],
        query as LogicalPlanTupleOperator
      );
      return new operators.FnCall(
        'sql',
        [{ op: new operators.MapToItem('sql', col, query) }],
        ret1
      );
    }

    return new operators.Quantifier('sql', node.quantifier, query);
  }
  visitIdentifier(node: ASTIdentifier): LogicalPlanOperator {
    return new operators.FnCall('sql', [node], ret1, true);
  }
  visitSQLIdentifier(node: AST.SQLIdentifier): LogicalPlanOperator {
    return this.visitIdentifier(node);
  }
  visitTableAlias(node: AST.ASTTableAlias): LogicalPlanTupleOperator {
    const src =
      node.table instanceof ASTIdentifier
        ? new operators.TupleSource('sql', node.table)
        : toTuples(node.table.accept(this));
    if (node.columns?.length) {
      if (node.columns.length !== src.schema?.length)
        throw new Error(
          `Column count mismatch: ${
            node.nameOriginal
          }(${node.columnsOriginal.join(', ')}) as opposed to (${src.schema
            ?.map((x) => x.parts.join('.'))
            .join(', ')})`
        );
      return new operators.Projection(
        'sql',
        node.columns.map((x, i) => [
          src.schema[i],
          AST.SQLIdentifier.fromParts([node.name, x]),
        ]),
        src
      );
    }
    if (src instanceof operators.TupleFnSource) {
      src.alias = ASTIdentifier.fromParts([node.name]);
      return src;
    }
    if (src instanceof operators.TupleSource) {
      src.name = [
        src.name as ASTIdentifier,
        ASTIdentifier.fromParts([node.name]),
      ];
      return src;
    }
    return new operators.Projection(
      'sql',
      src.schema.map((x) => [x, overrideTable(node.name, x)]),
      src
    );
  }
  visitExpressionAlias(node: AST.ASTExpressionAlias): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }

  private processOrderItem(x: AST.OrderByItem): operators.Order {
    return {
      ascending: x.ascending,
      key: this.toCalc(x.expression),
      nullsFirst: x.nullsFirst,
    };
  }
  private processOrderBy(
    op: LogicalPlanTupleOperator,
    node: AST.SelectStatement
  ): LogicalPlanTupleOperator {
    const orderItems = node.orderBy.map(this.processOrderItem);
    let proj = op instanceof operators.Distinct ? op.source : op;
    op = new operators.OrderBy('sql', orderItems, op);
    if (proj instanceof operators.Projection) {
      // otherwise it's a set op
      op = new operators.Projection('sql', proj.attrs.slice(), op);
      for (const oitem of orderItems) {
        if (
          oitem.key instanceof ASTIdentifier &&
          !proj.schemaSet.has(oitem.key.parts)
        ) {
          proj.addToSchema(oitem.key);
          proj.attrs.push([oitem.key, oitem.key]);
        } else if (oitem.key instanceof operators.Calculation) {
          for (const attr of this.inferrerMap['sql'].visitCalculation(
            oitem.key
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
    if (limit && !utils.assertCalcLiteral(limit, 'number'))
      throw new Error('Limit must be a number constant');
    if (offset && !utils.assertCalcLiteral(offset, 'number'))
      throw new Error('Offset must be a number constant');
    return new operators.Limit(
      'sql',
      offset ? (offset as operators.Calculation).impl() : 0,
      limit ? (limit as operators.Calculation).impl() : Infinity,
      op
    );
  }

  /**
   * should be called only by {@link SQLLogicalPlanBuilder#visitSelectSet},
   * which provides the `src` arg
   */
  visitSelectSetOp(
    node: AST.SelectSetOp,
    left: LogicalPlanTupleOperator = null
  ): LogicalPlanTupleOperator {
    let next = node.next.accept(this) as LogicalPlanTupleOperator;
    switch (node.type) {
      case AST.SelectSetOpType.UNION:
        next = new operators.Union('sql', left, next);
        break;
      case AST.SelectSetOpType.INTERSECT:
        next = new operators.Intersection('sql', left, next);
        break;
      case AST.SelectSetOpType.EXCEPT:
        next = new operators.Difference('sql', left, next);
        break;
    }
    if (node.distinct) {
      next = new operators.Distinct('sql', allAttrs, next);
    }
    return next;
  }

  visitSelectSet(node: AST.SelectSet): LogicalPlanTupleOperator {
    let op = node.from
      ? this.getTableName(node.from)[0]
      : new operators.NullSource('sql');
    const items = node.items.map(this.processAttr);
    const aggregates = items.flatMap(getAggrs);
    if (node.windows) {
      throw new UnsupportedError('Window functions not supported');
    }
    if (node.where) {
      op = new operators.Selection('sql', this.toCalc(node.where), op);
    }
    if (aggregates.length) {
      op = this.visitGroupByClause(node.groupBy, op, aggregates);
    }
    if (node.having) {
      op = new operators.Selection('sql', this.toCalc(node.having), op);
    }
    op = new operators.Projection('sql', items, op);
    if (node.distinct) {
      op = new operators.Distinct(
        'sql',
        node.distinct === true ? allAttrs : node.distinct.map(this.toCalc),
        op
      );
    }
    if (node.setOp) {
      op = this.visitSelectSetOp(node.setOp, op);
    }
    return op;
  }

  private processAttr(
    attr: ASTNode
  ): Aliased<ASTIdentifier | operators.Calculation> {
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
    aggregates: operators.AggregateCall[] = []
  ): LogicalPlanTupleOperator {
    let attrs: Aliased<ASTIdentifier | operators.Calculation>[] = [];
    if (node) {
      if (node.type !== AST.GroupByType.BASIC)
        throw new UnsupportedError(
          `Group by type "${node.type}" not supported`
        );
      attrs = (node.items as ASTNode[]).map(this.processAttr);
    }
    const res = new operators.GroupBy('sql', attrs, aggregates, src);
    for (const aggr of aggregates) {
      aggr.postGroupSource.schema.push(...attrs.map(retI1));
    }
    return res;
  }

  private getTableName(
    node: ASTIdentifier | AST.ASTTableAlias | AST.JoinClause
  ): [LogicalPlanTupleOperator, ASTIdentifier] {
    const src =
      node instanceof ASTIdentifier
        ? new operators.TupleSource('sql', node)
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
    let op: LogicalPlanTupleOperator = new operators.CartesianProduct(
      'sql',
      left,
      right
    );

    if (node.condition) {
      op = new operators.Selection('sql', this.toCalc(node.condition), op);
    } else if (node.using) {
      if (!leftName)
        throw new Error('Using can be only used with two named relations');

      const usingRight = node.using.map((x) => overrideTable(rightName, x));
      const rightSet = utils.schemaToTrie(usingRight);
      op = new operators.Selection(
        'sql',
        new operators.Calculation(
          'sql',
          (...args) => {
            const half = args.length / 2;
            for (let i = 0; i < half; i++) {
              if (args[i] !== args[i + half]) return false;
            }
            return true;
          },
          usingRight.concat(node.using.map((x) => overrideTable(leftName, x)))
        ),
        op
      );
      op = new operators.Projection(
        'sql',
        op.schema.filter((x) => !rightSet.has(x.parts)).map((x) => [x, x]),
        op
      );
    }
    return op;
  }
  visitCase(node: AST.ASTCase): LogicalPlanOperator {
    return new operators.Conditional(
      'sql',
      node.expr && this.processNode(node.expr),
      node.whenThen.map(([w, t]) => [this.processNode(w), this.processNode(t)]),
      node.elseExpr && this.processNode(node.elseExpr)
    );
  }
  visitValues(node: AST.ValuesClause): LogicalPlanOperator {
    const calcs = node.values.map((x) => x.map(this.toCalc));
    const external = calcs.flatMap((x) =>
      x.filter((x) => x instanceof ASTIdentifier || x.args.length > 0)
    );

    const res = new operators.TupleFnSource('sql', external, function* (
      ...args
    ) {
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
    const res = new operators.AggregateCall(
      node.lang,
      node.args.map(this.toCalc),
      impl,
      toId(this.stringifier.visitAggregate(node))
    );

    if (node.filter) {
      res.postGroupOp = new operators.Selection(
        'sql',
        this.toCalc(node.filter),
        res.postGroupOp
      );
    }
    if (node.distinct) {
      res.postGroupOp = new operators.Distinct(
        'sql',
        res.args,
        res.postGroupOp
      );
    }
    if (node.orderBy) {
      res.postGroupOp = new operators.OrderBy(
        'sql',
        node.orderBy.map(this.processOrderItem),
        res.postGroupOp
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
    let res: LogicalPlanTupleOperator = new operators.TupleFnSource(
      'sql',
      node.args.map(this.toCalc),
      impl.impl
    );
    if (impl.outputSchema) {
      res.addToSchema(impl.outputSchema);
    }
    if (node.withOrdinality)
      res = new operators.ProjectionIndex('sql', toId('ordinality'), res);
    return res;
  }
  visitRowsFrom(node: AST.RowsFrom): LogicalPlanOperator {
    throw new UnsupportedError('Rows from not supported.');
  }
  visitWithQuery(node: AST.WithQuery): LogicalPlanOperator {
    throw new UnsupportedError('With queries not supported');
  }
  visitLiteral<U>(node: ASTLiteral<U>): LogicalPlanOperator {
    return new operators.Literal('sql', node.value);
  }
  visitOperator(node: ASTOperator): LogicalPlanOperator {
    return new operators.FnCall(
      node.lang,
      node.operands.map((x) => ({ op: x.accept(this) })), // identifiers should be processed into FnCalls, so that we can set pure=true without concerns
      this.langMgr.getOp(node.lang, ...idToPair(node.id)).impl,
      true
    );
  }
  visitFunction(node: ASTFunction): LogicalPlanOperator {
    const [id, schema] = idToPair(node.id);
    const impl = this.langMgr.getFnOrAggr('sql', id, schema); // throw the error

    if ('init' in impl) {
      return new operators.AggregateCall(
        node.lang,
        node.args.map(this.toCalc),
        impl,
        toId(this.stringifier.visitFunction(node))
      );
    }
    return new operators.FnCall(
      node.lang,
      node.args.map(this.processFnArg),
      impl.impl
    );
  }
  visitLangSwitch(node: LangSwitch): LogicalPlanOperator {
    const lang = this.langMgr.getLang(node.lang);
    return node.node.accept(new lang.visitors.logicalPlanBuilder(this.langMgr));
  }
}
