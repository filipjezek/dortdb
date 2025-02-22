import { ASTIdentifier, IdSet } from '@dortdb/core';
import { Trie } from '@dortdb/core/data-structures';

export function isTableAttr(
  attr: ASTIdentifier,
  table: ASTIdentifier | IdSet,
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
