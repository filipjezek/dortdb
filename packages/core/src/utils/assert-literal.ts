import { ASTLiteral } from '../ast.js';

export function assertLiteral(value: any, type: Function | string) {
  return (
    value &&
    value instanceof ASTLiteral &&
    (!type || typeof type === 'string'
      ? typeof value.value === type
      : value.value instanceof type)
  );
}
