import { ASTIdentifier } from '@dortdb/core';
import { ASTVariable, XQueryIdentifier } from '../ast/expression.js';

export const DOT = new ASTVariable(
  ASTIdentifier.fromParts(['fs', 'dot']) as XQueryIdentifier,
);
export const POS = new ASTVariable(
  ASTIdentifier.fromParts(['fs', 'position']) as XQueryIdentifier,
);
export const LEN = new ASTVariable(
  ASTIdentifier.fromParts(['fs', 'last']) as XQueryIdentifier,
);
