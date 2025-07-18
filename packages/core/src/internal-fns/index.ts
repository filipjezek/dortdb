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

export function assertMaxOne<T>(vals: T[]): T {
  if (vals.length === 0) return null;
  if (vals.length > 1) throw new Error('More than one element in sequence');
  return vals[0];
}

type RecursiveArray<T> = T[] | RecursiveArray<T>[];
export function flat<T>(input: RecursiveArray<T>): T[] | T {
  const flattened = (input as T[]).flat(Infinity) as T[];
  if (flattened.length === 1) {
    return flattened[0];
  }
  return flattened;
}

export function propLookup(n: any, parts: any[]) {
  for (const part of parts) {
    n = n[part];
  }
  return n;
}
export function createMapLiteral(names: any[], ...vals: any[]) {
  const res: Record<string | symbol, unknown> = {};
  for (let i = 0; i < vals.length; i++) {
    res[names[i]] = vals[i];
  }
  return res;
}
