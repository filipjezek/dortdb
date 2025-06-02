import { ASTVisitor } from '@dortdb/core';
import {
  XQueryIdentifier,
  ASTNumberLiteral,
  ASTSequenceType,
  ASTStringLiteral,
  ASTVariable,
  CastExpr,
  FilterExpr,
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
import { PathAxis, PathExpr, PathPredicate, SimpleMapExpr } from './path.js';
import {
  ComputedConstructor,
  DirConstrContent,
  DirectCommentConstructor,
  DirectElementConstructor,
  DirectPIConstructor,
} from './constructor.js';
import {
  BoundFunction,
  DynamicFunctionCall,
  InlineFunction,
} from './function.js';

export interface XQueryVisitor<Ret, Arg = never> extends ASTVisitor<Ret, Arg> {
  visitProlog(node: Prolog, arg?: Arg): Ret;
  visitDefaultNSDeclaration(node: DefaultNSDeclaration, arg?: Arg): Ret;
  visitBaseURIDeclaration(node: BaseURIDeclaration, arg?: Arg): Ret;
  visitOrderingDeclaration(node: OrderingDeclaration, arg?: Arg): Ret;
  visitEmptyOrderDeclaration(node: EmptyOrderDeclaration, arg?: Arg): Ret;
  visitNSDeclaration(node: NSDeclaration, arg?: Arg): Ret;
  visitStringLiteral(node: ASTStringLiteral, arg?: Arg): Ret;
  visitNumberLiteral(node: ASTNumberLiteral, arg?: Arg): Ret;
  visitXQueryIdentifier(node: XQueryIdentifier, arg?: Arg): Ret;
  visitVariable(node: ASTVariable, arg?: Arg): Ret;
  visitFLWORExpr(node: FLWORExpr, arg?: Arg): Ret;
  visitFLWORFor(node: FLWORFor, arg?: Arg): Ret;
  visitFLWORForBinding(node: FLWORForBinding, arg?: Arg): Ret;
  visitFLWORLet(node: FLWORLet, arg?: Arg): Ret;
  visitFLWORWindow(node: FLWORWindow, arg?: Arg): Ret;
  visitFLWORWhere(node: FLWORWhere, arg?: Arg): Ret;
  visitFLWORGroupBy(node: FLWORGroupBy, arg?: Arg): Ret;
  visitFLWOROrderBy(node: FLWOROrderBy, arg?: Arg): Ret;
  visitFLWORCount(node: FLWORCount, arg?: Arg): Ret;
  visitFLWORReturn(node: FLWORReturn, arg?: Arg): Ret;
  visitQuantifiedExpr(node: QuantifiedExpr, arg?: Arg): Ret;
  visitSwitchExpr(node: SwitchExpr, arg?: Arg): Ret;
  visitIfExpr(node: IfExpr, arg?: Arg): Ret;
  visitSequenceType(node: ASTSequenceType, arg?: Arg): Ret;
  visitInstanceOfExpr(node: InstanceOfExpr, arg?: Arg): Ret;
  visitCastExpr(node: CastExpr, arg?: Arg): Ret;
  visitItemType(node: ASTItemType, arg?: Arg): Ret;
  visitPathExpr(node: PathExpr, arg?: Arg): Ret;
  visitPathPredicate(node: PathPredicate, arg?: Arg): Ret;
  visitPathAxis(node: PathAxis, arg?: Arg): Ret;
  visitFilterExpr(node: FilterExpr, arg?: Arg): Ret;
  visitDynamicFunctionCall(node: DynamicFunctionCall, arg?: Arg): Ret;
  visitSequenceConstructor(node: SequenceConstructor, arg?: Arg): Ret;
  visitOrderedExpr(node: OrderedExpr, arg?: Arg): Ret;
  visitDirectElementConstructor(node: DirectElementConstructor, arg?: Arg): Ret;
  visitDirConstrContent(node: DirConstrContent, arg?: Arg): Ret;
  visitModule(node: Module, arg?: Arg): Ret;
  visitDirectPIConstructor(node: DirectPIConstructor, arg?: Arg): Ret;
  visitDirectCommentConstructor(node: DirectCommentConstructor, arg?: Arg): Ret;
  visitComputedConstructor(node: ComputedConstructor, arg?: Arg): Ret;
  visitInlineFn(node: InlineFunction, arg?: Arg): Ret;
  visitBoundFunction(node: BoundFunction, arg?: Arg): Ret;
  visitSimpleMapExpr(node: SimpleMapExpr, arg?: Arg): Ret;
}
