import { Trie } from '../data-structures/trie.js';
import { ASTIdentifier } from '../ast.js';
import { IdSet } from '../plan/visitor.js';

export function schemaToTrie(schema: ASTIdentifier[]) {
  const res = new Trie<string | symbol>();
  for (const id of schema) {
    res.add(id.parts);
  }
  return res;
}

export function union(...parts: (IdSet | ASTIdentifier[])[]): IdSet {
  const result = new Trie<string | symbol>();
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
  const result = new Trie<string | symbol>();
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
