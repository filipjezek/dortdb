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

export function union(a: IdSet, b: IdSet | ASTIdentifier[]): IdSet {
  const result = new Trie<string | symbol>();
  for (const id of a) {
    result.add(id);
  }
  if (Array.isArray(b)) {
    for (const id of b) {
      result.add(id.parts);
    }
  } else {
    for (const id of b) {
      result.add(id);
    }
  }
  return result;
}

export function difference(a: IdSet, b: IdSet): IdSet {
  const result = new Trie<string | symbol>();
  for (const id of a) {
    result.add(id);
  }
  for (const id of b) {
    result.delete(id);
  }
  return result;
}
