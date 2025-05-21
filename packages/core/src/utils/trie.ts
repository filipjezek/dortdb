import { Trie } from '../data-structures/trie.js';
import { ASTIdentifier } from '../ast.js';
import { IdSet } from '../plan/visitor.js';

export function schemaToTrie(schema: ASTIdentifier[]) {
  const res = new Trie<string | symbol | number>();
  for (const id of schema) {
    res.add(id.parts);
  }
  return res;
}

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

export function invert<K, V>(trie: Trie<K, V[]>): Trie<V, K[]> {
  const result = new Trie<V, K[]>();
  for (const [key, value] of trie.entries()) {
    result.set(value as V[], key);
  }
  return result;
}
