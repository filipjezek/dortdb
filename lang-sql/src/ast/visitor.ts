import { ASTVisitor } from '@dortdb/core';
import { SelectStatement } from './select';
import { NumberLiteral, StringLiteral } from './expression';

export interface SQLVisitor extends ASTVisitor {
  visitSelectStatement(node: SelectStatement): void;
  visitStringLiteral(node: StringLiteral): void;
  visitNumberLiteral(node: NumberLiteral): void;
}
