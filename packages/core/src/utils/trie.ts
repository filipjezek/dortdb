import { Trie } from 'mnemonist';
import { ASTIdentifier } from '../ast.js';
import { IdSet } from 'src/plan/visitor.js';

export function schemaToTrie(schema: ASTIdentifier[]) {
  const res = new Trie<(string | symbol)[]>(Array);
  for (const id of schema) {
    res.add(id.parts);
  }
  return res;
}

/**
 * Hack: the built-in trie iteration skips symbols, so we need to implement it ourselves.
 */
export function* iterTrie(trie: Trie<(string | symbol)[]>) {
  yield* iterTrieInner((trie as any).root, []);
}

const SENTINEL = String.fromCharCode(0);
type TrieInner = Record<string | symbol, unknown>;
function* iterTrieInner(
  lvl: TrieInner,
  path: (symbol | string)[],
): IterableIterator<(string | symbol)[]> {
  for (const key in lvl) {
    if (key === SENTINEL) {
      yield path;
    } else if (lvl[key]) {
      yield* iterTrieInner(lvl[key] as TrieInner, path.concat(key));
    }
  }
  for (const key of Object.getOwnPropertySymbols(lvl)) {
    yield* iterTrieInner(lvl[key] as TrieInner, path.concat(key));
  }
}

export function union(a: IdSet, b: IdSet): IdSet {
  const result = new Trie<(string | symbol)[]>(Array);
  for (const id of iterTrie(a)) {
    result.add(id);
  }
  for (const id of iterTrie(b)) {
    result.add(id);
  }
  return result;
}

export function difference(a: IdSet, b: IdSet): IdSet {
  const result = new Trie<(string | symbol)[]>(Array);
  for (const id of iterTrie(a)) {
    result.add(id);
  }
  for (const id of iterTrie(b)) {
    result.delete(id);
  }
  return result;
}
