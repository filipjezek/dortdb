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
  ASTIdentifier as ASTIdentifierClass,
} from '../ast/index.js';
import { SQLVisitor } from '../ast/visitor.js';
import { WindowSpec } from '../ast/window.js';
import { WithQuery } from '../ast/with.js';

export class ASTDeterministicStringifier implements SQLVisitor<string> {
  visitLangSwitch(node: LangSwitch): string {
    throw new Error('Method not implemented.');
  }
  visitStringLiteral(node: ASTStringLiteral): string {
    return this.addQuotes(node.value, "'");
  }
  visitNumberLiteral(node: ASTNumberLiteral): string {
    return node.value.toString();
  }
  visitArray(node: ASTArray): string {
    return node.items instanceof Array
      ? `ARRAY[${node.items.map((x) => x.accept(this)).join(',')}]`
      : `ARRAY(${node.items.accept(this)})`;
  }
  visitRow(node: ASTRow): string {
    return `ROW(${node.items.map((x) => x.accept(this)).join(',')})`;
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

  visitIdentifier(node: ASTIdentifierClass): string {
    let id = node.id === allAttrs ? '*' : this.addQuotes(node.id, '"');
    if (node.schema)
      id =
        (typeof node.schema === 'string'
          ? node.schema
          : node.schema.accept(this)) +
        '.' +
        id;
    return id;
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
      '"'
    )}`;
  }
  visitSelectStatement(node: SelectStatement): string {
    let res = node.selectSet.accept(this);
    if (node.withQueries)
      res =
        'WITH ' +
        node.withQueries.map((x) => x.accept(this)).join(',') +
        ' ' +
        res;
    if (node.orderBy)
      res +=
        ' ORDER BY ' +
        node.orderBy
          .map(
            (x) =>
              `${x.expression.accept(this)} ${
                x.ascending ? 'ASC' : 'DESC'
              } NULLS ${x.nullsFirst ? 'FIRST' : 'LAST'}`
          )
          .join(',');
    if (node.limit) res += ' LIMIT ' + node.limit.accept(this);
    if (node.offset) res += ' OFFSET ' + node.offset.accept(this);
    return res;
  }
  visitSelectSetOp(node: SelectSetOp): string {
    return `${node.type}${
      node.type === SelectSetOpType.UNION && !node.distinct ? ' ALL' : ''
    } ${node.next.accept(this)}`;
  }
  visitSelectSet(node: SelectSet): string {
    let res = `SELECT${node.distinct ? ' DISTINCT' : ''} ${node.items
      .map((x) => x.accept(this))
      .join(',')}`;
    if (node.from) res += ` FROM ${node.from.accept(this)}`;
    if (node.where) res += ` WHERE ${node.where.accept(this)}`;
    if (node.groupBy) res += ` ${node.groupBy.accept(this)}`;
    if (node.having) res += ` HAVING ${node.having.accept(this)}`;
    if (node.windows)
      res += ` WINDOW ${node.windows.map((x) => x.accept(this)).join(',')}`;
    if (node.setOp) res += ` ${node.setOp.accept(this)}`;
    return res;
  }
  visitGroupByClause(node: GroupByClause): string {
    let res = node.type === GroupByType.BASIC ? '' : node.type;
    if (node.items[0] instanceof Array) {
      res += node.items
        .map(
          (x) => `(${(x as ASTNode[]).map((y) => y.accept(this)).join(',')})`
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
      return res + ' USING (' + node.using.map((x) => x.accept(this)).join(',');
    return res;
  }
  visitCase(node: ASTCase): string {
    throw new Error('Method not implemented.');
  }
  visitValues(node: ValuesClause): string {
    throw new Error('Method not implemented.');
  }
  visitAggregate(node: ASTAggregate): string {
    throw new Error('Method not implemented.');
  }
  visitWindowSpec(node: WindowSpec): string {
    throw new Error('Method not implemented.');
  }
  visitWindowFn(node: ASTWindowFn): string {
    throw new Error('Method not implemented.');
  }
  visitTableFn(node: TableFn): string {
    throw new Error('Method not implemented.');
  }
  visitRowsFrom(node: RowsFrom): string {
    throw new Error('Method not implemented.');
  }
  visitWithQuery(node: WithQuery): string {
    throw new Error('Method not implemented.');
  }
  visitLiteral<U>(node: ASTLiteral<U>): string {
    throw new Error('Method not implemented.');
  }
  visitOperator(node: ASTOperator): string {
    throw new Error('Method not implemented.');
  }
  visitFunction(node: ASTFunction): string {
    throw new Error('Method not implemented.');
  }
}
