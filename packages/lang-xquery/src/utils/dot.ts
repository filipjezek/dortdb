import { ASTIdentifier } from '@dortdb/core';

/** Identifier for the XQuery context item column (`fs:dot` / `.`). */
export const DOT = ASTIdentifier.fromParts(['fs', 'dot']);
/** Identifier for the XQuery context position column (`fs:position`). */
export const POS = ASTIdentifier.fromParts(['fs', 'position']);
/** Identifier for the XQuery context size column (`fs:last`). */
export const LEN = ASTIdentifier.fromParts(['fs', 'last']);
