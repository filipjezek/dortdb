import { Trie } from 'mnemonist';
import { ASTIdentifier } from '../ast.js';

export function schemaToTrie(schema: ASTIdentifier[]) {
  const res = new Trie<(string | symbol)[]>(Array);
  for (const id of schema) {
    res.add(id.parts);
  }
  return res;
}
