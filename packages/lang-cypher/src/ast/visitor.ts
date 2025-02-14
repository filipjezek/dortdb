import { ASTVisitor } from '@dortdb/core';
import * as ast from './index.js';

export interface CypherVisitor<T> extends ASTVisitor<T> {
  visitCypherIdentifier(node: ast.CypherIdentifier): T;
  visitStringLiteral(node: ast.ASTStringLiteral): T;
  visitNumberLiteral(node: ast.ASTNumberLiteral): T;
  visitListLiteral(node: ast.ASTListLiteral): T;
  visitMapLiteral(node: ast.ASTMapLiteral): T;
  visitBooleanLiteral(node: ast.ASTBooleanLiteral): T;
  visitFnCallWrapper(node: ast.FnCallWrapper): T;
  visitExistsSubquery(node: ast.ExistsSubquery): T;
  visitQuantifiedExpr(node: ast.QuantifiedExpr): T;
  visitPatternElChain(node: ast.PatternElChain): T;
  visitParameter(node: ast.ASTParameter): T;
  visitNodePattern(node: ast.NodePattern): T;
  visitRelPattern(node: ast.RelPattern): T;
  visitPatternComprehension(node: ast.PatternComprehension): T;
  visitListComprehension(node: ast.ListComprehension): T;
  visitCaseExpr(node: ast.CaseExpr): T;
  visitCountAll(node: ast.CountAll): T;
  visitLabelFilterExpr(node: ast.LabelFilterExpr): T;
  visitSubscriptExpr(node: ast.SubscriptExpr): T;
  visitPropLookup(node: ast.PropLookup): T;
  visitSetOp(node: ast.SetOp): T;
  visitQuery(node: ast.Query): T;
  visitMatchClause(node: ast.MatchClause): T;
  visitUnwindClause(node: ast.UnwindClause): T;
  visitCreateClause(node: ast.CreateClause): T;
  visitMergeClause(node: ast.MergeClause): T;
  visitSetClause(node: ast.SetClause): T;
  visitSetItem(node: ast.SetItem): T;
  visitRemoveClause(node: ast.RemoveClause): T;
  visitRemoveItem(node: ast.RemoveItem): T;
  visitDeleteClause(node: ast.DeleteClause): T;
  visitProjectionBody(node: ast.ProjectionBody): T;
  visitOrderItem(node: ast.OrderItem): T;
  visitWithClause(node: ast.WithClause): T;
  visitReturnClause(node: ast.ReturnClause): T;
}
