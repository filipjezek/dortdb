import { ASTIdentifier } from '../ast.js';
import { Calculation } from '../plan/operators/index.js';
import { Aliased, OpOrId, PlanOperator } from '../plan/visitor.js';

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
export function clone<T extends PlanOperator>(x: T): T {
  return x.clone() as T;
}
export function cloneIfPossible<T extends OpOrId | Aliased<OpOrId>>(x: T): T {
  if (!x) return x;
  if (Array.isArray(x)) {
    return [cloneIfPossible(x[0]), x[1]] as T;
  }
  if (x instanceof ASTIdentifier) {
    return x;
  }
  return x.clone() as T;
}
export function toArray<T>(x: Iterable<T>): T[] {
  return Array.isArray(x) ? x : Array.from(x);
}
