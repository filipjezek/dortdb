import {
  ASTLiteral,
  ASTOperator,
  ASTFunction,
  LangSwitch,
  ASTNode,
  allAttrs,
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
  SelectSetOpType,
  GroupByType,
  SQLIdentifier,
  OrderByItem,
} from '../ast/index.js';
import { SQLVisitor } from '../ast/visitor.js';
import { WindowSpec } from '../ast/window.js';
import { SearchType, WithQuery } from '../ast/with.js';

export class ASTDeterministicStringifier implements SQLVisitor<string> {
  private uniqueId = 0;

  constructor() {
    this.processNode = this.processNode.bind(this);
    this.visitSchemaPart = this.visitSchemaPart.bind(this);
  }

  private processNode(x: ASTNode) {
    return x.accept(this);
  }

  visitLangSwitch(node: LangSwitch): string {
    return `lang_${node.lang}_${this.uniqueId++}`;
  }
  visitStringLiteral(node: ASTStringLiteral): string {
    return this.addQuotes(node.value, "'");
  }
  visitNumberLiteral(node: ASTNumberLiteral): string {
    return node.value.toString();
  }
  visitArray(node: ASTArray): string {
    return node.items instanceof Array
      ? `ARRAY[${node.items.map(this.processNode).join(',')}]`
      : `ARRAY(${node.items.accept(this)})`;
  }
  visitRow(node: ASTRow): string {
    return `ROW(${node.items.map(this.processNode).join(',')})`;
  }
  visitParam(node: ASTParam): string {
    return ':' + node.name;
  }
  visitCast(node: ASTCast): string {
    return `CAST(${node.expr.accept(this)} AS ${node.type.accept(this)})`;
  }
  visitSubscript(node: ASTSubscript): string {
    return `${node.expr.accept(this)}[${node.from.accept(this)}${
      node.to ? ':' + node.to.accept(this) : ''
    }]`;
  }
  visitExists(node: ASTExists): string {
    return `EXISTS(${node.query.accept(this)})`;
  }
  visitQuantifier(node: ASTQuantifier): string {
    return `${node.quantifier}(${node.query.accept(this)})`;
  }

  private visitSchemaPart(node: string | symbol): string {
    return typeof node === 'symbol'
      ? node === allAttrs
        ? '*'
        : node.toString()
      : this.addQuotes(node, '"');
  }
  visitIdentifier(node: SQLIdentifier): string {
    const id = node.parts.map(this.visitSchemaPart).join('.');
    return id;
  }
  visitSQLIdentifier(node: SQLIdentifier): string {
    return this.visitIdentifier(node);
  }
  private addQuotes(str: string, quot: '"' | "'") {
    return quot + str.replaceAll(quot, quot + quot) + quot;
  }

  visitTableAlias(node: ASTTableAlias): string {
    let alias = `AS ${this.addQuotes(node.name, '"')}(${node.columns
      .map((x) => this.addQuotes(x, '"'))
      .join(',')})`;
    if (node.table) alias = node.table.accept(this) + ' ' + alias;
    return alias;
  }
  visitExpressionAlias(node: ASTExpressionAlias): string {
    // TODO: aliases could have different names but same contents, check for duplicates
    return `${node.expression.accept(this)} AS ${this.addQuotes(
      node.alias,
      '"',
    )}`;
  }
  visitSelectStatement(node: SelectStatement): string {
    let res = node.selectSet.accept(this);
    if (node.withQueries)
      res =
        'WITH ' + node.withQueries.map(this.processNode).join(',') + ' ' + res;
    if (node.orderBy) res += this.visitOrderBy(node.orderBy);
    if (node.limit) res += ' LIMIT ' + node.limit.accept(this);
    if (node.offset) res += ' OFFSET ' + node.offset.accept(this);
    return res;
  }
  private visitOrderBy(nodes: OrderByItem[]): string {
    return nodes
      .map(
        (x) =>
          `${x.expression.accept(this)} ${x.ascending ? 'ASC' : 'DESC'} NULLS ${
            x.nullsFirst ? 'FIRST' : 'LAST'
          }`,
      )
      .join(',');
  }

  visitSelectSetOp(node: SelectSetOp): string {
    return `${node.type}${
      node.type === SelectSetOpType.UNION && !node.distinct ? ' ALL' : ''
    } ${node.next.accept(this)}`;
  }
  visitSelectSet(node: SelectSet): string {
    let res = `SELECT${node.distinct ? ' DISTINCT' : ''} ${node.items
      .map(this.processNode)
      .join(',')}`;
    if (node.from) res += ` FROM ${node.from.accept(this)}`;
    if (node.where) res += ` WHERE ${node.where.accept(this)}`;
    if (node.groupBy) res += ` ${node.groupBy.accept(this)}`;
    if (node.having) res += ` HAVING ${node.having.accept(this)}`;
    if (node.windows)
      res += ` WINDOW ${Object.keys(node.windows)
        .toSorted()
        .map(
          (x) => this.addQuotes(x, '"') + ' AS ' + node.windows[x].accept(this),
        )
        .join(',')}`;
    if (node.setOp) res += ` ${node.setOp.accept(this)}`;
    return res;
  }
  visitGroupByClause(node: GroupByClause): string {
    let res = node.type === GroupByType.BASIC ? '' : node.type;
    if (node.items[0] instanceof Array) {
      res += node.items
        .map(
          (x) => `(${(x as ASTNode[]).map((y) => y.accept(this)).join(',')})`,
        )
        .join(',');
    } else {
      res += node.items.map((x) => (x as ASTNode).accept(this)).join(',');
    }
    return res;
  }
  visitJoinClause(node: JoinClause): string {
    // natural joins are not supported
    const res =
      node.tableLeft.accept(this) +
      ' ' +
      node.joinType +
      ' JOIN ' +
      node.lateral
        ? 'LATERAL '
        : '' + node.tableRight.accept(this);
    if (node.condition) return res + ' ON ' + node.condition.accept(this);
    if (node.using)
      return res + ' USING (' + node.using.map(this.processNode).join(',');
    return res;
  }
  visitCase(node: ASTCase): string {
    return `CASE ${node.expr?.accept(this) ?? ''} ${node.whenThen
      .map(([w, t]) => `WHEN ${w.accept(this)} THEN ${t.accept(this)}`)
      .join(' ')} ${
      node.elseExpr ? ' ELSE ' + node.elseExpr.accept(this) : ''
    } END`;
  }
  visitValues(node: ValuesClause): string {
    return `VALUES (${node.values
      .map((x) => '(' + x.map((y) => y.accept(this)).join(',') + ')')
      .join(',')})`;
  }
  visitAggregate(node: ASTAggregate): string {
    let res = node.id.accept(this) + '(';
    if (node.distinct) res += 'DISTINCT ';
    res += node.args.map(this.processNode).join(',');
    if (node.orderBy) res += ' ' + this.visitOrderBy(node.orderBy);
    res += ')';
    if (node.withinGroupArgs)
      res +=
        ' WITHIN GROUP(ORDER BY ' +
        this.visitOrderBy(node.withinGroupArgs) +
        ')';
    if (node.filter) res += ' FILTER(WHERE ' + node.filter.accept(this) + ')';
    return res;
  }
  visitWindowSpec(node: WindowSpec): string {
    let res = '(';
    if (node.parent) res += node.parent;
    if (node.columns)
      res += ' PARTITION BY ' + node.columns.map(this.processNode).join(',');
    if (node.order) res += ' ORDER BY ' + this.visitOrderBy(node.order);
    if (node.mode) {
      res += ' ' + node.mode + ' ';
      if (node.end) {
        res +=
          'BETWEEN ' +
          this.visitFrameBoundary(node.start, true) +
          ' AND ' +
          this.visitFrameBoundary(node.end, false);
      } else {
        res += this.visitFrameBoundary(node.start, true);
      }
      if (node.exclude) res += ' EXCLUDE ' + node.exclude;
    }
    return res + ')';
  }
  private visitFrameBoundary(x: ASTNode, start: boolean): string {
    const prefol = start ? ' PRECEDING' : ' FOLLOWING';
    if (x instanceof ASTLiteral) {
      switch (x.value) {
        case Infinity:
          return 'UNBOUNDED' + prefol;
        case 0:
          return 'CURRENT ROW';
        default:
          return x.value + prefol;
      }
    }
    return x.accept(this) + prefol;
  }

  visitWindowFn(node: ASTWindowFn): string {
    let res =
      node.id.accept(this) +
      '(' +
      node.args.map(this.processNode).join(',') +
      ')';
    if (node.filter) res += ' FILTER(WHERE ' + node.filter.accept(this) + ')';
    res += ' OVER ' + node.window.accept(this);
    return res;
  }
  visitTableFn(node: TableFn): string {
    let res = this.visitFunction(node);
    if (node.withOrdinality) res += ' WITH ORDINALITY';
    return res;
  }
  visitRowsFrom(node: RowsFrom): string {
    let res = 'ROWS FROM ' + node.tableFns.map(this.processNode).join(',');
    if (node.withOrdinality) res += ' WITH ORDINALITY';
    return res;
  }
  visitWithQuery(node: WithQuery): string {
    let res = 'WITH ';
    if (node.recursive) res += 'RECURSIVE ';
    res += this.visitIdentifier(node.name);
    if (node.colNames)
      res += '(' + node.colNames.map(this.processNode).join(',') + ')';
    res += ' AS';
    if (node.materialized) res += ' MATERIALIZED';
    res += '(' + node.query.accept(this) + ')';
    if (node.searchType) {
      res += ` SEARCH ${
        node.searchType === SearchType.BFS ? 'BREADTH' : 'DEPTH'
      } FIRST BY ${node.searchCols
        .map(this.processNode)
        .join(',')} SET ${node.searchName.accept(this)}`;
    }
    if (node.cycleCols) {
      res += ` CYCLE ${node.cycleCols
        .map(this.processNode)
        .join(',')} SET ${node.cycleMarkName.accept(this)}`;
      if (node.cycleMarkVal) {
        res += ` TO ${node.cycleMarkVal.accept(
          this,
        )} DEFAULT ${node.cycleMarkDefault.accept(this)}`;
      }
      res += `USING ${node.cyclePathName.accept(this)}`;
    }
    return res;
  }
  visitLiteral<U>(node: ASTLiteral<U>): string {
    return node.value.toString();
  }
  visitOperator(node: ASTOperator): string {
    return `${node.id.accept(this)}(${node.operands.map((x) =>
      x.accept(this),
    )})`;
  }
  visitFunction(node: ASTFunction): string {
    return `${node.id.accept(this)}(${node.args.map(this.processNode)})`;
  }
}
