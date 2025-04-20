import { ASTIdentifier } from '../ast.js';
import { Calculation } from '../plan/operators/index.js';

export function ret1<T>(a: T): T {
  return a;
}
export function ret2<T>(a: unknown, i: T) {
  return i;
}
export function retI0<T>(x: [T, ...unknown[]]): T {
  return x[0];
}
export function retI1<T>(x: [unknown, T, ...unknown[]]): T {
  return x[1];
}
export function toPair<T>(x: T): [T, T] {
  return [x, x];
}
export function isCalc(x: unknown): x is Calculation {
  return x instanceof Calculation;
}
export function isId(x: unknown): x is ASTIdentifier {
  return x instanceof ASTIdentifier;
}
export function isNotNull<T>(x: T): x is NonNullable<T> {
  return x !== null;
}
