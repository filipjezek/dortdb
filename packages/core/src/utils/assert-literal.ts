import { ASTLiteral } from '../ast.js';
import { Calculation } from '../plan/operators/index.js';

export function assertLiteral(value: unknown, type: Function | string) {
  return (
    value &&
    value instanceof ASTLiteral &&
    (!type || typeof type === 'string'
      ? typeof value.value === type
      : value.value instanceof type)
  );
}

export function assertCalcLiteral(value: unknown, type: Function | string) {
  if (!value || !(value instanceof Calculation) || !value.literal) return false;
  const res = value.impl();
  return !type || typeof type === 'string'
    ? typeof res === type
    : res instanceof type;
}
