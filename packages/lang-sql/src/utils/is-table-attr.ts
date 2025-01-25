import { ASTIdentifier } from '@dortdb/core';

export function isTableAttr(
  attr: ASTIdentifier,
  table: ASTIdentifier
): boolean {
  if (attr.parts.length !== table.parts.length + 1) return false;
  for (let i = 0; i < table.parts.length; i++) {
    if (attr.parts[i] !== table.parts[i]) return false;
  }
}
