import { ASTIdentifier } from '../ast.js';

export function overrideSource(
  id: ASTIdentifier,
  table: ASTIdentifier | string
) {
  return ASTIdentifier.fromParts(
    table instanceof ASTIdentifier
      ? [...table.parts, id.parts[id.parts.length - 1]]
      : [table, id.parts[id.parts.length - 1]]
  );
}
