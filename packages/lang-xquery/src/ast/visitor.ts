import { ASTVisitor } from '@dortdb/core';
import {
  ArgumentPlaceholder,
  ASTName,
  ASTNumberLiteral,
  ASTSequenceType,
  ASTStringLiteral,
  ASTVariable,
  CastExpr,
  FilterExpr,
  FunctionCall,
  IfExpr,
  InstanceOfExpr,
  OrderedExpr,
  QuantifiedExpr,
  SequenceConstructor,
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
  Module,
  NSDeclaration,
  OrderingDeclaration,
  Prolog,
} from './prolog.js';
import { ASTItemType } from './item-type.js';
import { CurrentItemRef, PathAxis, PathExpr, PathPredicate } from './path.js';
import {
  DirConstrContent,
  DirectCommentConstructor,
  DirectElementConstructor,
  DirectPIConstructor,
} from './constructor.js';

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
  visitSequenceType(node: ASTSequenceType): T;
  visitInstanceOfExpr(node: InstanceOfExpr): T;
  visitCastExpr(node: CastExpr): T;
  visitItemType(node: ASTItemType): T;
  visitPathExpr(node: PathExpr): T;
  visitPathPredicate(node: PathPredicate): T;
  visitPathAxis(node: PathAxis): T;
  visitFilterExpr(node: FilterExpr): T;
  visitFunctionCall(node: FunctionCall): T;
  visitArgumentPlaceholder(node: ArgumentPlaceholder): T;
  visitCurrentItemRef(node: CurrentItemRef): T;
  visitSequenceConstructor(node: SequenceConstructor): T;
  visitOrderedExpr(node: OrderedExpr): T;
  visitDirectElementConstructor(node: DirectElementConstructor): T;
  visitDirConstrContent(node: DirConstrContent): T;
  visitModule(node: Module): T;
  visitDirectPIConstructor(node: DirectPIConstructor): T;
  visitDirectCommentConstructor(node: DirectCommentConstructor): T;
}
