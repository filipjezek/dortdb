import { ASTIdentifier, ASTVisitor } from '@dortdb/core';
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
  SQLIdentifier,
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

export interface SQLVisitor<Ret, Arg = never> extends ASTVisitor<Ret, Arg> {
  visitStringLiteral(node: ASTStringLiteral, arg?: Arg): Ret;
  visitNumberLiteral(node: ASTNumberLiteral, arg?: Arg): Ret;
  visitArray(node: ASTArray, arg?: Arg): Ret;
  visitRow(node: ASTRow, arg?: Arg): Ret;
  visitParam(node: ASTParam, arg?: Arg): Ret;
  visitCast(node: ASTCast, arg?: Arg): Ret;
  visitSubscript(node: ASTSubscript, arg?: Arg): Ret;
  visitExists(node: ASTExists, arg?: Arg): Ret;
  visitQuantifier(node: ASTQuantifier, arg?: Arg): Ret;
  visitIdentifier(node: ASTIdentifier, arg?: Arg): Ret;
  visitSQLIdentifier(node: SQLIdentifier, arg?: Arg): Ret;
  visitTableAlias(node: ASTTableAlias, arg?: Arg): Ret;
  visitExpressionAlias(node: ASTExpressionAlias, arg?: Arg): Ret;
  visitSelectStatement(node: SelectStatement, arg?: Arg): Ret;
  visitSelectSetOp(node: SelectSetOp, arg?: Arg): Ret;
  visitSelectSet(node: SelectSet, arg?: Arg): Ret;
  visitGroupByClause(node: GroupByClause, arg?: Arg): Ret;
  visitJoinClause(node: JoinClause, arg?: Arg): Ret;
  visitCase(node: ASTCase, arg?: Arg): Ret;
  visitValues(node: ValuesClause, arg?: Arg): Ret;
  visitAggregate(node: ASTAggregate, arg?: Arg): Ret;
  visitWindowSpec(node: WindowSpec, arg?: Arg): Ret;
  visitWindowFn(node: ASTWindowFn, arg?: Arg): Ret;
  visitTableFn(node: TableFn, arg?: Arg): Ret;
  visitRowsFrom(node: RowsFrom, arg?: Arg): Ret;
  visitWithQuery(node: WithQuery, arg?: Arg): Ret;
}
