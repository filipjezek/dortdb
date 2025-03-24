import { ASTVisitor } from '@dortdb/core';
import * as ast from './index.js';

export interface CypherVisitor<Ret, Arg = never> extends ASTVisitor<Ret, Arg> {
  visitCypherIdentifier(node: ast.CypherIdentifier, arg?: Arg): Ret;
  visitStringLiteral(node: ast.ASTStringLiteral, arg?: Arg): Ret;
  visitNumberLiteral(node: ast.ASTNumberLiteral, arg?: Arg): Ret;
  visitListLiteral(node: ast.ASTListLiteral, arg?: Arg): Ret;
  visitMapLiteral(node: ast.ASTMapLiteral, arg?: Arg): Ret;
  visitBooleanLiteral(node: ast.ASTBooleanLiteral, arg?: Arg): Ret;
  visitFnCallWrapper(node: ast.FnCallWrapper, arg?: Arg): Ret;
  visitExistsSubquery(node: ast.ExistsSubquery, arg?: Arg): Ret;
  visitQuantifiedExpr(node: ast.QuantifiedExpr, arg?: Arg): Ret;
  visitPatternElChain(node: ast.PatternElChain, arg?: Arg): Ret;
  visitNodePattern(node: ast.NodePattern, arg?: Arg): Ret;
  visitRelPattern(node: ast.RelPattern, arg?: Arg): Ret;
  visitPatternComprehension(node: ast.PatternComprehension, arg?: Arg): Ret;
  visitListComprehension(node: ast.ListComprehension, arg?: Arg): Ret;
  visitCaseExpr(node: ast.CaseExpr, arg?: Arg): Ret;
  visitCountAll(node: ast.CountAll, arg?: Arg): Ret;
  visitLabelFilterExpr(node: ast.LabelFilterExpr, arg?: Arg): Ret;
  visitSubscriptExpr(node: ast.SubscriptExpr, arg?: Arg): Ret;
  visitPropLookup(node: ast.PropLookup, arg?: Arg): Ret;
  visitSetOp(node: ast.SetOp, arg?: Arg): Ret;
  visitQuery(node: ast.Query, arg?: Arg): Ret;
  visitMatchClause(node: ast.MatchClause, arg?: Arg): Ret;
  visitUnwindClause(node: ast.UnwindClause, arg?: Arg): Ret;
  visitCreateClause(node: ast.CreateClause, arg?: Arg): Ret;
  visitMergeClause(node: ast.MergeClause, arg?: Arg): Ret;
  visitSetClause(node: ast.SetClause, arg?: Arg): Ret;
  visitSetItem(node: ast.SetItem, arg?: Arg): Ret;
  visitRemoveClause(node: ast.RemoveClause, arg?: Arg): Ret;
  visitRemoveItem(node: ast.RemoveItem, arg?: Arg): Ret;
  visitDeleteClause(node: ast.DeleteClause, arg?: Arg): Ret;
  visitProjectionBody(node: ast.ProjectionBody, arg?: Arg): Ret;
  visitOrderItem(node: ast.OrderItem, arg?: Arg): Ret;
  visitWithClause(node: ast.WithClause, arg?: Arg): Ret;
  visitReturnClause(node: ast.ReturnClause, arg?: Arg): Ret;
}
