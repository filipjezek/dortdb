import {
  ASTLiteral,
  ASTOperator,
  ASTFunction,
  ASTIdentifier,
  LogicalPlanOperator,
  Limit,
  LangSwitch,
  LanguageManager,
  Projection,
  Aliased,
  ASTNode,
  CartesianProduct,
  Selection,
  Calculation,
  UnsupportedError,
  allAttrs,
  CalculationParams,
  LogicalPlanVisitor,
  Literal,
  FnCall,
  LogicalOpOrId,
  OrderBy,
  utils,
  Intersection,
  Difference,
  Union,
  Distinct,
  UnionAll,
  NullSource,
  GroupBy,
  LogicalPlanTupleOperator,
  Conditional,
  AggregateCall,
  TupleSource,
  Order,
  MapFromItem,
  ProjectionIndex,
  TupleFnSource,
  MapToItem,
  QuantifierType,
  Quantifier,
} from '@dortdb/core';
import {
  ASTTableAlias,
  ASTExpressionAlias,
  ASTAggregate,
  ASTArray,
  ASTCase,
  ASTCast,
  ASTExists,
  ASTNumberLiteral,
  ASTParam,
  ASTQuantifier,
  ASTRow,
  ASTStringLiteral,
  ASTSubscript,
  ASTWindowFn,
  GroupByClause,
  JoinClause,
  RowsFrom,
  SelectSet,
  SelectSetOp,
  SelectStatement,
  TableFn,
  ValuesClause,
  WindowSpec,
  WithQuery,
  SelectSetOpType,
  SQLIdentifier,
  GroupByType,
  OrderByItem,
} from '../ast/index.js';
import { SQLVisitor } from '../ast/visitor.js';
import { ASTDeterministicStringifier } from './ast-stringifier.js';
import { Trie } from 'mnemonist';

function toId(id: string | symbol): ASTIdentifier {
  return SQLIdentifier.fromParts([id]);
}
function overrideTable(
  name: string | ASTIdentifier,
  attr: ASTIdentifier
): ASTIdentifier {
  return SQLIdentifier.fromParts(
    (name instanceof ASTIdentifier ? name.parts : [name]).concat([
      attr.parts[attr.parts.length - 1],
    ])
  );
}
function ret1<T>(x: T): T {
  return x;
}
function getAggrs([item]: Aliased<
  Calculation | ASTIdentifier
>): AggregateCall[] {
  return item instanceof Calculation ? item.aggregates ?? [] : [];
}
function assertOne<T>(x: Iterable<T>): T {
  const iter = x[Symbol.iterator]();
  const res = iter.next();
  if (res.done) throw new Error('Empty sequence');
  if (!iter.next().done) throw new Error('More than one element in sequence');
  return res.value;
}
function idToPair(id: ASTIdentifier): [string, string] {
  return [
    id.parts[id.parts.length - 1] as string,
    id.parts[id.parts.length - 2] as string,
  ];
}

export class SQLLogicalPlanBuilder implements SQLVisitor<LogicalPlanOperator> {
  private stringifier = new ASTDeterministicStringifier();
  private calcBuilders: Record<string, LogicalPlanVisitor<CalculationParams>>;

  constructor(private langMgr: LanguageManager) {
    this.calcBuilders = langMgr.getVisitorMap('calculationBuilder');
    this.processNode = this.processNode.bind(this);
    this.processAttr = this.processAttr.bind(this);
    this.toCalc = this.toCalc.bind(this);
    this.processOrderItem = this.processOrderItem.bind(this);
  }

  private processNode(item: ASTNode): LogicalOpOrId {
    return item instanceof ASTIdentifier ? item : item.accept(this);
  }
  private toCalc(node: ASTNode): Calculation | ASTIdentifier {
    if (node instanceof ASTIdentifier) return node;
    const calcParams = node.accept(this).accept(this.calcBuilders);
    return new Calculation(
      'sql',
      calcParams.impl,
      calcParams.args,
      calcParams.aggregates,
      calcParams.literal
    );
  }

  visitStringLiteral(node: ASTStringLiteral): LogicalPlanOperator {
    return new Literal('sql', node.value);
  }
  visitNumberLiteral(node: ASTNumberLiteral): LogicalPlanOperator {
    return new Literal('sql', node.value);
  }
  visitArray(node: ASTArray): LogicalPlanOperator {
    if (Array.isArray(node.items)) {
      return new FnCall('sql', node.items.map(this.processNode), Array, true);
    }
    return new FnCall('sql', [node.items.accept(this)], Array.from, true);
  }
  visitRow(node: ASTRow): LogicalPlanOperator {
    const attrs = node.items.map(this.processAttr);
    return new FnCall(
      'sql',
      attrs.map((x) => x[0]),
      (...args) => {
        const res: Record<string | symbol, any> = {};
        for (let i = 0; i < args.length; i++) {
          res[attrs[i][1].parts[0]] = args[i];
        }
        return res;
      }
    );
  }
  visitParam(node: ASTParam): LogicalPlanOperator {
    return new FnCall('sql', [toId(node.name)], ret1, true);
  }
  visitCast(node: ASTCast): LogicalPlanOperator {
    const impl = this.langMgr.getCast('sql', ...idToPair(node.type));
    return new FnCall(
      'sql',
      [node.expr.accept(this)],
      node.isArray
        ? impl.convert
        : (x) => {
            Array.isArray(x)
              ? x.map(impl.convert)
              : Array.from(x).map(impl.convert);
          },
      !node.isArray && impl.pure
    );
  }
  visitSubscript(node: ASTSubscript): LogicalPlanOperator {
    const expr = node.expr.accept(this);
    const index = node.from.accept(this);
    return node.to
      ? new FnCall(
          'sql',
          [expr, index, node.to.accept(this)],
          (e, f, t) => e.slice(f, t),
          true
        )
      : new FnCall('sql', [expr, index], (e, i) => e[i], true);
  }
  visitExists(node: ASTExists): LogicalPlanOperator {
    let res = node.query.accept(this) as LogicalPlanOperator;
    res = new Limit('sql', 0, 1, res);
    const col = toId('count');
    res = new GroupBy(
      'sql',
      [],
      [
        new AggregateCall(
          'sql',
          [toId(allAttrs)],
          this.langMgr.getAggr('sql', 'count'),
          col
        ),
      ],
      res as Limit
    );
    res = new MapToItem('sql', col, res as GroupBy);
    return new FnCall('sql', [res], assertOne);
  }

  visitQuantifier(node: ASTQuantifier): LogicalPlanOperator {
    let query = node.query.accept(this) as LogicalPlanTupleOperator;
    if (query.schema.length !== 1)
      throw new Error('Quantified subquery must return exactly one column');
    const col = query.schema[0];
    let agg: string;
    switch (node.parentOp) {
      case '>':
      case '>=':
        agg = node.quantifier === QuantifierType.ALL ? 'max' : 'min';
        break;
      case '<':
      case '<=':
        agg = node.quantifier === QuantifierType.ALL ? 'min' : 'max';
        break;
    }
    if (agg) {
      query = new GroupBy(
        'sql',
        [],
        [
          new AggregateCall(
            'sql',
            [col],
            this.langMgr.getAggr('sql', agg),
            col
          ),
        ],
        query as LogicalPlanTupleOperator
      );
      return new FnCall('sql', [new MapToItem('sql', col, query)], assertOne);
    }

    return new Quantifier('sql', node.quantifier, query);
  }
  visitIdentifier(node: ASTIdentifier): LogicalPlanOperator {
    return new FnCall('sql', [node], ret1, true);
  }
  visitSQLIdentifier(node: SQLIdentifier): LogicalPlanOperator {
    return this.visitIdentifier(node);
  }
  visitTableAlias(node: ASTTableAlias): LogicalPlanTupleOperator {
    const src = node.table.accept(this) as LogicalPlanTupleOperator;
    if (node.columns) {
      if (node.columns.length !== src.schema?.length)
        throw new Error(
          `Column count mismatch: ${
            node.nameOriginal
          }(${node.columnsOriginal.join(', ')}) as opposed to (${src.schema
            ?.map((x) => x.parts.join('.'))
            .join(', ')})`
        );
      return new Projection(
        'sql',
        node.columns.map((x, i) => [
          src.schema[i],
          SQLIdentifier.fromParts([node.name, x]),
        ]),
        src
      );
    }
    return new Projection(
      'sql',
      src.schema.map((x) => [x, overrideTable(node.name, x)]),
      src
    );
  }
  visitExpressionAlias(node: ASTExpressionAlias): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }

  private processOrderItem(x: OrderByItem): Order {
    return {
      ascending: x.ascending,
      key: this.toCalc(x.expression),
      nullsFirst: x.nullsFirst,
    };
  }
  visitSelectStatement(node: SelectStatement) {
    if (node.withQueries?.length)
      throw new UnsupportedError('With queries not supported');
    let op = this.visitSelectSet(node.selectSet);
    if (node.orderBy?.length) {
      op = new OrderBy('sql', node.orderBy.map(this.processOrderItem), op);
    }
    if (node.limit || node.offset) {
      op = this.buildLimit(node, op);
    }
    return op;
  }
  private buildLimit(node: SelectStatement, op: LogicalPlanTupleOperator) {
    const limit = node.limit && this.toCalc(node.limit);
    const offset = node.offset && this.toCalc(node.offset);
    if (limit && !utils.assertCalcLiteral(limit, 'number'))
      throw new Error('Limit must be a number constant');
    if (offset && !utils.assertCalcLiteral(offset, 'number'))
      throw new Error('Offset must be a number constant');
    return new Limit(
      'sql',
      offset ? (offset as Calculation).impl() : 0,
      limit ? (limit as Calculation).impl() : Infinity,
      op
    );
  }

  /**
   * should be called only by {@link SQLLogicalPlanBuilder#visitSelectSet},
   * which provides the `src` arg
   */
  visitSelectSetOp(
    node: SelectSetOp,
    left: LogicalPlanTupleOperator = null
  ): LogicalPlanTupleOperator {
    let next = node.next.accept(this) as LogicalPlanTupleOperator;
    switch (node.type) {
      case SelectSetOpType.UNION:
        return node.distinct
          ? new UnionAll('sql', left, next)
          : new Union('sql', left, next);
      case SelectSetOpType.INTERSECT:
        return new Intersection('sql', left, next);
      case SelectSetOpType.EXCEPT:
        return new Difference('sql', left, next);
    }
  }

  visitSelectSet(node: SelectSet): LogicalPlanTupleOperator {
    let op = node.from
      ? (node.from.accept(this) as LogicalPlanTupleOperator)
      : new NullSource('sql');
    const items = node.items.map(this.processAttr);
    const aggregates = items.flatMap(getAggrs);
    if (node.windows) {
      throw new UnsupportedError('Window functions not supported');
    }
    if (node.where) {
      op = new Selection('sql', this.toCalc(node.where), op);
    }
    if (aggregates.length) {
      op = this.visitGroupByClause(node.groupBy, op, aggregates);
    }
    if (node.having) {
      op = new Selection('sql', this.toCalc(node.having), op);
    }
    op = new Projection('sql', items, op);
    if (node.distinct) {
      op = new Distinct(
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

  private processAttr(attr: ASTNode): Aliased<ASTIdentifier | Calculation> {
    if (attr instanceof SQLIdentifier) {
      return [attr, attr];
    }
    if (attr instanceof ASTExpressionAlias) {
      const alias = toId(attr.alias);
      if (attr.expression instanceof SQLIdentifier) {
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
    node: GroupByClause,
    src: LogicalPlanTupleOperator = null,
    aggregates: AggregateCall[] = []
  ): LogicalPlanTupleOperator {
    if (node.type !== GroupByType.BASIC)
      throw new UnsupportedError(`Group by type "${node.type}" not supported`);
    const attrs = (node.items as ASTNode[]).map(this.processAttr);
    const res = new GroupBy('sql', attrs, aggregates, src);
    for (const aggr of aggregates) {
      aggr.postGroupSource.schema.push(...res.schema);
    }
    return res;
  }

  private renameSrcTable(
    node: ASTIdentifier | ASTTableAlias | JoinClause
  ): [LogicalPlanTupleOperator, ASTIdentifier] {
    const src =
      node instanceof ASTIdentifier
        ? new TupleSource('sql', node)
        : (node.accept(this) as LogicalPlanTupleOperator);
    if (node instanceof JoinClause) return [src, null];
    const name = node instanceof ASTIdentifier ? node : toId(node.name);
    if (!src.schema) return [src, name];
    return [
      new Projection(
        'sql',
        src.schema.map((x) => [x, overrideTable(name, x)]),
        src
      ),
      name,
    ];
  }
  visitJoinClause(node: JoinClause): LogicalPlanTupleOperator {
    if (node.natural) throw new UnsupportedError('Natural joins not supported');
    if (node.lateral) throw new UnsupportedError('Lateral joins not supported');
    const [left, leftName] = this.renameSrcTable(node.tableLeft);
    const [right, rightName] = this.renameSrcTable(node.tableRight);
    // TODO: outer joins
    let op: LogicalPlanTupleOperator = new CartesianProduct('sql', left, right);

    if (node.condition) {
      op = new Selection('sql', this.toCalc(node.condition), op);
    } else if (node.using) {
      if (!leftName)
        throw new Error('Using can be only used with two named relations');

      const usingRight = node.using.map((x) => overrideTable(rightName, x));
      const rightSet = Trie.from(usingRight);
      op = new Selection(
        'sql',
        new Calculation(
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
      op = new Projection(
        'sql',
        op.schema.filter((x) => !rightSet.has(x)).map((x) => [x, x]),
        op
      );
    }
    return op;
  }
  visitCase(node: ASTCase): LogicalPlanOperator {
    return new Conditional(
      'sql',
      node.expr && this.processNode(node.expr),
      node.whenThen.map(([w, t]) => [this.processNode(w), this.processNode(t)]),
      node.elseExpr && this.processNode(node.elseExpr)
    );
  }
  visitValues(node: ValuesClause): LogicalPlanOperator {
    const calcs = node.values.map((x) => x.map(this.toCalc));
    const external = calcs.flatMap((x) =>
      x.filter((x) => x instanceof ASTIdentifier || x.args.length > 0)
    );

    return new TupleFnSource('sql', external, function* (...args) {
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
  }
  visitAggregate(node: ASTAggregate): LogicalPlanOperator {
    const impl = this.langMgr.getAggr(node.lang, ...idToPair(node.id));
    if (node.withinGroupArgs)
      throw new UnsupportedError('Within group not supported');
    const res = new AggregateCall(
      node.lang,
      node.args.map(this.toCalc),
      impl,
      toId(this.stringifier.visitAggregate(node))
    );

    if (node.filter) {
      res.postGroupOp = new Selection(
        'sql',
        this.toCalc(node.filter),
        res.postGroupOp
      );
    }
    if (node.distinct) {
      res.postGroupOp = new Distinct('sql', res.args, res.postGroupOp);
    }
    if (node.orderBy) {
      res.postGroupOp = new OrderBy(
        'sql',
        node.orderBy.map(this.processOrderItem),
        res.postGroupOp
      );
    }
    return res;
  }
  visitWindowSpec(node: WindowSpec): LogicalPlanOperator {
    throw new UnsupportedError('Window functions not supported');
  }
  visitWindowFn(node: ASTWindowFn): LogicalPlanOperator {
    throw new UnsupportedError('Window functions not supported');
  }
  visitTableFn(node: TableFn): LogicalPlanOperator {
    const impl = this.langMgr.getFn(node.lang, ...idToPair(node.id));
    let res: LogicalPlanTupleOperator = new TupleFnSource(
      'sql',
      node.args.map(this.toCalc),
      impl.impl
    );
    if (node.withOrdinality)
      res = new ProjectionIndex('sql', toId('ordinality'), res);
    return res;
  }
  visitRowsFrom(node: RowsFrom): LogicalPlanOperator {
    throw new UnsupportedError('Rows from not supported.');
  }
  visitWithQuery(node: WithQuery): LogicalPlanOperator {
    throw new UnsupportedError('With queries not supported');
  }
  visitLiteral<U>(node: ASTLiteral<U>): LogicalPlanOperator {
    return new Literal('sql', node.value);
  }
  visitOperator(node: ASTOperator): LogicalPlanOperator {
    return new FnCall(
      node.lang,
      node.operands.map((x) => x.accept(this)),
      this.langMgr.getOp(node.lang, ...idToPair(node.id)).impl,
      true
    );
  }
  visitFunction(node: ASTFunction): LogicalPlanOperator {
    const [id, schema] = idToPair(node.id);
    const impl =
      this.langMgr.getFn(node.lang, id, schema, false) ??
      this.langMgr.getAggr(node.lang, id, schema, false) ??
      this.langMgr.getFn(node.lang, id, schema, true); // throw the error

    if ('init' in impl) {
      return new AggregateCall(
        node.lang,
        node.args.map(this.toCalc),
        impl,
        toId(this.stringifier.visitFunction(node))
      );
    }
    return new FnCall(
      node.lang,
      node.args.map(this.processNode),
      this.langMgr.getFn(node.lang, id, schema).impl
    );
  }
  visitLangSwitch(node: LangSwitch): LogicalPlanOperator {
    const lang = this.langMgr.getLang(node.lang);
    return node.node.accept(new lang.visitors.logicalPlanBuilder(this.langMgr));
  }
}
