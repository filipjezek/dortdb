import { XQueryIdentifier } from '../ast/expression.js';

export const DOT = XQueryIdentifier.fromParts(['fs', 'dot']);
export const POS = XQueryIdentifier.fromParts([Symbol('position')]);
export const LEN = XQueryIdentifier.fromParts([Symbol('length')]);
