import { ASTIdentifier } from '../ast.js';

/** Returns a new {@link ASTIdentifier} that keeps only the last name part of `id` but prefixed with `table`. */
export function overrideSource(
  table: ASTIdentifier | string,
  id: ASTIdentifier,
) {
  return ASTIdentifier.fromParts(
    table instanceof ASTIdentifier
      ? [...table.parts, id.parts.at(-1)]
      : [table, id.parts.at(-1)],
  );
}
