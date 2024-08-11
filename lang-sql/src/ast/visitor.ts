import { ASTVisitor } from '@dortdb/core';
import {
  GroupByClause,
  JoinClause,
  JoinUsing,
  OrderByItem,
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
import {
  ASTExpressionAlias,
  ASTFieldSelector,
  ASTTableAlias,
} from './alias.js';
import { WindowSpec } from './window.js';

export interface SQLVisitor extends ASTVisitor {
  visitStringLiteral(node: ASTStringLiteral): void;
  visitNumberLiteral(node: ASTNumberLiteral): void;
  visitArray(node: ASTArray): void;
  visitRow(node: ASTRow): void;
  visitParam(node: ASTParam): void;
  visitCast(node: ASTCast): void;
  visitSubscript(node: ASTSubscript): void;
  visitExists(node: ASTExists): void;
  visitQuantifier(node: ASTQuantifier): void;
  visitIdentifier(node: ASTIdentifier): void;
  visitTableAlias(node: ASTTableAlias): void;
  visitFieldSelector(node: ASTFieldSelector): void;
  visitExpressionAlias(node: ASTExpressionAlias): void;
  visitSelectStatement(node: SelectStatement): void;
  visitSelectSetOp(node: SelectSetOp): void;
  visitSelectSet(node: SelectSet): void;
  visitOrderByItem(node: OrderByItem): void;
  visitGroupByClause(node: GroupByClause): void;
  visitJoinClause(node: JoinClause): void;
  visitJoinUsing(node: JoinUsing): void;
  visitCase(node: ASTCase): void;
  visitValues(node: ValuesClause): void;
  visitAggregate(node: ASTAggregate): void;
  visitWindowSpec(node: WindowSpec): void;
  visitWindowFn(node: ASTWindowFn): void;
  visitTableFn(node: TableFn): void;
  visitRowsFrom(node: RowsFrom): void;
}
