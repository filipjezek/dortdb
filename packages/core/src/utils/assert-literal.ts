import { ASTLiteral } from '../ast.js';
import { Calculation } from '../plan/operators/index.js';

/** Returns `true` if `value` is an {@link ASTLiteral} whose inner value matches the given type (constructor or `typeof` string). */
export function assertLiteral(value: unknown, type: Function | string) {
  return (
    value &&
    value instanceof ASTLiteral &&
    (!type || typeof type === 'string'
      ? typeof value.value === type
      : value.value instanceof type)
  );
}

/** Returns `true` if `value` is a literal {@link Calculation} whose evaluated result matches the given type. */
export function assertCalcLiteral(value: unknown, type: Function | string) {
  if (!value || !(value instanceof Calculation) || !value.literal) return false;
  const res = value.impl();
  return !type || typeof type === 'string'
    ? typeof res === type
    : res instanceof type;
}
