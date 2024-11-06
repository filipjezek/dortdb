import { ASTVisitor } from '@dortdb/core';
import * as ast from './index.js';

export interface CypherVisitor<T> extends ASTVisitor<T> {
  visitIdentifier(node: ast.ASTIdentifier): T;
  visitStringLiteral(node: ast.ASTStringLiteral): T;
  visitNumberLiteral(node: ast.ASTNumberLiteral): T;
  visitListLiteral(node: ast.ASTListLiteral): T;
  visitMapLiteral(node: ast.ASTMapLiteral): T;
  visitBooleanLiteral(node: ast.ASTBooleanLiteral): T;
  visitFnCallWrapper(node: ast.FnCallWrapper): T;
}
