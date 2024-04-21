import { ASTVisitor } from '@dortdb/core';
import { SelectStatement } from './select.js';
import { NumberLiteral, StringLiteral } from './expression.js';

export interface SQLVisitor extends ASTVisitor {
  visitSelectStatement(node: SelectStatement): void;
  visitStringLiteral(node: StringLiteral): void;
  visitNumberLiteral(node: NumberLiteral): void;
}
