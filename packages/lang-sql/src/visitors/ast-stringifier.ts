import {
  ASTLiteral,
  ASTOperator,
  ASTFunction,
  ASTIdentifier,
  LangSwitch,
} from '@dortdb/core';
import {
  ASTTableAlias,
  ASTFieldSelector,
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

  visitIdentifier(node: ASTIdentifier): string {
    return (
      (node.schema ? this.addQuotes(node.schema, '"') + '.' : '') +
      this.addQuotes(node.id, '"')
    );
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
  visitFieldSelector(node: ASTFieldSelector): string {
    let field =
      node.fieldOriginal === '*' ? '*' : this.addQuotes(node.field, '"');
    if (node.table) field = node.table.accept(this) + '.' + field;
    return field;
  }
  visitExpressionAlias(node: ASTExpressionAlias): string {
    throw new Error('Method not implemented.');
  }
  visitSelectStatement(node: SelectStatement): string {
    throw new Error('Method not implemented.');
  }
  visitSelectSetOp(node: SelectSetOp): string {
    throw new Error('Method not implemented.');
  }
  visitSelectSet(node: SelectSet): string {
    throw new Error('Method not implemented.');
  }
  visitGroupByClause(node: GroupByClause): string {
    throw new Error('Method not implemented.');
  }
  visitJoinClause(node: JoinClause): string {
    throw new Error('Method not implemented.');
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
