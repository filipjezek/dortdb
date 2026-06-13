/**
 * Low-level helper functions used when building and transforming logical
 * plans - argument combinators (`ret1`, `ret2`, `toPair`), type guards,
 * plan-operator cloning helpers, and small array/object utilities.
 *
 * @packageDocumentation
 */

import { ASTIdentifier } from '../ast.js';
import {
  AggregateCall,
  CalcIntermediate,
  Calculation,
} from '../plan/operators/index.js';
import { Aliased, OpOrId, PlanOperator } from '../plan/visitor.js';
import { ArgMeta } from '../visitors/calculation-builder.js';

/** Returns its first argument unchanged. */
export function ret1<T>(a: T): T {
  return a;
}
/** Returns its second argument unchanged. */
export function ret2<T>(a: unknown, i: T) {
  return i;
}
/** Returns the first element of a tuple. */
export function retI0<T>(x: [T, ...unknown[]]): T {
  return x[0];
}
/** Returns the second element of a tuple. */
export function retI1<T>(x: [unknown, T, ...unknown[]]): T {
  return x[1];
}
/** Wraps a value in a two-element tuple `[x, x]`. */
export function toPair<T>(x: T): [T, T] {
  return [x, x];
}
/** Type guard for {@link Calculation}. */
export function isCalc(x: unknown): x is Calculation {
  return x instanceof Calculation;
}
/** Type guard for {@link ASTIdentifier}. */
export function isId(x: unknown): x is ASTIdentifier {
  return x instanceof ASTIdentifier;
}
/** Type guard narrowing out `null` and `undefined`. */
export function isNotNull<T>(x: T): x is NonNullable<T> {
  return x !== null;
}
/** Clones a plan operator via its `clone()` method. */
export function clone<T extends PlanOperator>(x: T): T {
  return x.clone() as T;
}
/**
 * Clones plan operators in an {@link OpOrId} or `Aliased<OpOrId>`, leaving
 * {@link ASTIdentifier}s and `null`/`undefined` in place.
 */
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
/**
 * Like {@link cloneIfPossible} but passes `args` to the `clone()` call for
 * nodes that accept updated argument metadata (e.g. {@link AggregateCall}).
 */
export function cloneWithArgs<T extends OpOrId | Aliased<OpOrId>>(
  x: T,
  args: ArgMeta[],
): T {
  if (!x) return x;
  if (Array.isArray(x)) {
    return [cloneWithArgs(x[0], args), x[1]] as T;
  }
  if (x instanceof ASTIdentifier) {
    return x;
  }
  if (CalcIntermediate in x || x instanceof AggregateCall) {
    return x.clone(args) as T;
  }
  return x.clone() as T;
}
/** Converts an iterable to an array; returns the original if it is already an array. */
export function toArray<T>(x: Iterable<T>): T[] {
  return Array.isArray(x) ? x : Array.from(x);
}

/**
 * Returns the single element of `vals`, or `null` if it is empty.
 * @throws {Error} if `vals` contains more than one element.
 */
export function assertMaxOne<T>(vals: T[]): T {
  if (vals.length === 0) return null;
  if (vals.length > 1) throw new Error('More than one element in sequence');
  return vals[0];
}

type RecursiveArray<T> = T[] | RecursiveArray<T>[];
/** Deeply flattens a recursive array; if the result has exactly one element, returns that element directly. */
export function flat<T>(input: RecursiveArray<T>): T[] | T {
  const flattened = (input as T[]).flat(Infinity) as T[];
  if (flattened.length === 1) {
    return flattened[0];
  }
  return flattened;
}

/** Traverses `n` by successive property accesses through `parts`; returns `undefined` safely if any step is nullish. */
export function propLookup(n: any, parts: any[]) {
  for (const part of parts) {
    n = n?.[part];
  }
  return n;
}
/** Builds a plain object mapping each entry in `names` to the corresponding value in `vals`. */
export function createMapLiteral(names: any[], ...vals: any[]) {
  const res: Record<string | symbol, unknown> = {};
  for (let i = 0; i < vals.length; i++) {
    res[names[i]] = vals[i];
  }
  return res;
}

/** Returns a new array containing only the elements of `arr` at the given `indices`, in order. */
export function pickArr<T>(arr: T[], indices: number[]): T[] {
  const res: T[] = [];
  for (const i of indices) {
    res.push(arr[i]);
  }
  return res;
}
