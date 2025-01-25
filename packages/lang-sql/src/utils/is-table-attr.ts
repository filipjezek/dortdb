import { ASTIdentifier } from '@dortdb/core';
import { Trie } from 'mnemonist';

export function isTableAttr(
  attr: ASTIdentifier,
  table: ASTIdentifier | Trie<(string | symbol)[]>
): boolean {
  if (table instanceof Trie) {
    return table.has(attr.parts.slice(0, -1));
  }
  if (attr.parts.length !== table.parts.length + 1) return false;
  for (let i = 0; i < table.parts.length; i++) {
    if (attr.parts[i] !== table.parts[i]) return false;
  }
  return true;
}
