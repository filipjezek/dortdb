import { ASTVisitor } from '@dortdb/core';

export interface CypherVisitor<T> extends ASTVisitor<T> {}
