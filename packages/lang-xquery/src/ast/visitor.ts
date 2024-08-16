import { ASTVisitor } from '@dortdb/core';
import {
  ASTName,
  ASTNumberLiteral,
  ASTStringLiteral,
  ASTVariable,
  IfExpr,
  QuantifiedExpr,
  SwitchExpr,
} from './expression.js';
import {
  FLWORCount,
  FLWORExpr,
  FLWORFor,
  FLWORForBinding,
  FLWORGroupBy,
  FLWORLet,
  FLWOROrderBy,
  FLWORReturn,
  FLWORWhere,
  FLWORWindow,
} from './flwor.js';
import {
  BaseURIDeclaration,
  DefaultNSDeclaration,
  EmptyOrderDeclaration,
  NSDeclaration,
  OrderingDeclaration,
  Prolog,
} from './prolog.js';

export interface XQueryVisitor<T> extends ASTVisitor<T> {
  visitProlog(node: Prolog): T;
  visitDefaultNSDeclaration(node: DefaultNSDeclaration): T;
  visitBaseURIDeclaration(node: BaseURIDeclaration): T;
  visitOrderingDeclaration(node: OrderingDeclaration): T;
  visitEmptyOrderDeclaration(node: EmptyOrderDeclaration): T;
  visitNSDeclaration(node: NSDeclaration): T;
  visitStringLiteral(node: ASTStringLiteral): T;
  visitNumberLiteral(node: ASTNumberLiteral): T;
  visitName(node: ASTName): T;
  visitVariable(node: ASTVariable): T;
  visitFLWORExpr(node: FLWORExpr): T;
  visitFLWORFor(node: FLWORFor): T;
  visitFLWORForBinding(node: FLWORForBinding): T;
  visitFLWORLet(node: FLWORLet): T;
  visitFLWORWindow(node: FLWORWindow): T;
  visitFLWORWhere(node: FLWORWhere): T;
  visitFLWORGroupBy(node: FLWORGroupBy): T;
  visitFLWOROrderBy(node: FLWOROrderBy): T;
  visitFLWORCount(node: FLWORCount): T;
  visitFLWORReturn(node: FLWORReturn): T;
  visitQuantifiedExpr(node: QuantifiedExpr): T;
  visitSwitchExpr(node: SwitchExpr): T;
  visitIfExpr(node: IfExpr): T;
}
