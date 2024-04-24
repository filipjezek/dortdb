import { ASTVisitor } from '@dortdb/core';
import { SelectStatement } from './select.js';
import {
  ASTArray,
  ASTParam,
  ASTNumberLiteral,
  ASTStringLiteral,
  ASTCast,
  ASTSubscript,
  ASTIdentifier,
} from './expression.js';
import { ASTFieldSelector, ASTTableAlias } from './alias.js';

export interface SQLVisitor extends ASTVisitor {
  visitSelectStatement(node: SelectStatement): void;
  visitStringLiteral(node: ASTStringLiteral): void;
  visitNumberLiteral(node: ASTNumberLiteral): void;
  visitArray(node: ASTArray): void;
  visitParam(node: ASTParam): void;
  visitCast(node: ASTCast): void;
  visitSubscript(node: ASTSubscript): void;
  visitIdentifier(node: ASTIdentifier): void;
  visitTableAlias(node: ASTTableAlias): void;
  visitFieldSelector(node: ASTFieldSelector): void;
}
