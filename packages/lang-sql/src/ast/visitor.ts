import { ASTVisitor } from '@dortdb/core';
import {
  GroupByClause,
  JoinClause,
  SelectSet,
  SelectSetOp,
  SelectStatement,
  ValuesClause,
  TableFn,
  RowsFrom,
} from './select.js';
import {
  ASTArray,
  ASTParam,
  ASTNumberLiteral,
  ASTStringLiteral,
  ASTCast,
  ASTSubscript,
  ASTIdentifier,
  ASTExists,
  ASTQuantifier,
  ASTCase,
  ASTRow,
  ASTAggregate,
  ASTWindowFn,
} from './expression.js';
import { ASTExpressionAlias, ASTTableAlias } from './alias.js';
import { WindowSpec } from './window.js';
import { WithQuery } from './with.js';

export interface SQLVisitor<T> extends ASTVisitor<T> {
  visitStringLiteral(node: ASTStringLiteral): T;
  visitNumberLiteral(node: ASTNumberLiteral): T;
  visitArray(node: ASTArray): T;
  visitRow(node: ASTRow): T;
  visitParam(node: ASTParam): T;
  visitCast(node: ASTCast): T;
  visitSubscript(node: ASTSubscript): T;
  visitExists(node: ASTExists): T;
  visitQuantifier(node: ASTQuantifier): T;
  visitIdentifier(node: ASTIdentifier): T;
  visitTableAlias(node: ASTTableAlias): T;
  visitExpressionAlias(node: ASTExpressionAlias): T;
  visitSelectStatement(node: SelectStatement): T;
  visitSelectSetOp(node: SelectSetOp): T;
  visitSelectSet(node: SelectSet): T;
  visitGroupByClause(node: GroupByClause): T;
  visitJoinClause(node: JoinClause): T;
  visitCase(node: ASTCase): T;
  visitValues(node: ValuesClause): T;
  visitAggregate(node: ASTAggregate): T;
  visitWindowSpec(node: WindowSpec): T;
  visitWindowFn(node: ASTWindowFn): T;
  visitTableFn(node: TableFn): T;
  visitRowsFrom(node: RowsFrom): T;
  visitWithQuery(node: WithQuery): T;
}
