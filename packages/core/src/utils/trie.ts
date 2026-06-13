import { Trie } from '../data-structures/trie.js';
import { ASTIdentifier } from '../ast.js';
import { IdSet } from '../plan/visitor.js';

/** Converts an array of {@link ASTIdentifier}s into an {@link IdSet} trie. */
export function schemaToTrie(schema: ASTIdentifier[]) {
  const res = new Trie<string | symbol | number>();
  for (const id of schema) {
    res.add(id.parts);
  }
  return res;
}

/** Returns an {@link IdSet} containing all identifiers from every input set or array. */
export function union(...parts: (IdSet | ASTIdentifier[])[]): IdSet {
  const result = new Trie<string | symbol | number>();
  for (const part of parts) {
    if (Array.isArray(part)) {
      for (const id of part) {
        result.add(id.parts);
      }
    } else {
      for (const id of part) {
        result.add(id);
      }
    }
  }
  return result;
}

/** Returns an {@link IdSet} with all identifiers in `a` that are absent from every set in `others`. */
export function difference(a: IdSet, ...others: IdSet[]): IdSet {
  const result = new Trie<string | symbol | number>();
  for (const id of a) {
    result.add(id);
  }
  for (const b of others) {
    for (const id of b) {
      result.delete(id);
    }
  }
  return result;
}

/** Returns an {@link IdSet} containing only the identifiers present in both `a` and `b`. */
export function restriction(a: IdSet, b: IdSet | ASTIdentifier[]): IdSet {
  const result = new Trie<string | symbol | number>();
  if (Array.isArray(b)) {
    for (const id of b) {
      if (a.has(id.parts)) {
        result.add(id.parts);
      }
    }
  } else {
    for (const id of b) {
      if (a.has(id)) {
        result.add(id);
      }
    }
  }
  return result;
}

/** Returns `true` if `a` contains every identifier in `b`. */
export function containsAll(a: IdSet, b: IdSet | ASTIdentifier[]): boolean {
  if (Array.isArray(b)) {
    for (const id of b) {
      if (!a.has(id.parts)) {
        return false;
      }
    }
  } else {
    for (const id of b) {
      if (!a.has(id)) {
        return false;
      }
    }
  }
  return true;
}
/** Returns `true` if `a` contains at least one identifier from `b`. */
export function containsAny(a: IdSet, b: IdSet | ASTIdentifier[]): boolean {
  if (Array.isArray(b)) {
    for (const id of b) {
      if (a.has(id.parts)) {
        return true;
      }
    }
  } else {
    for (const id of b) {
      if (a.has(id)) {
        return true;
      }
    }
  }
  return false;
}

/** Inverts a `Trie<K, V[]>` into a `Trie<V, K[]>`, mapping each value back to its key. */
export function invert<K, V>(trie: Trie<K, V[]>): Trie<V, K[]> {
  const result = new Trie<V, K[]>();
  for (const [key, value] of trie.entries()) {
    result.set(value as V[], key);
  }
  return result;
}
