import { ASTNode } from '@dortdb/core';
import { CypherVisitor } from './visitor.js';
import { ASTIdentifier, ASTMapLiteral, ASTNumberLiteral } from './literal.js';
import { ASTParameter } from './index.js';

export class PatternElChain implements ASTNode {
  public chain: (NodePattern | RelPattern)[];
  public variable?: ASTIdentifier;

  constructor(chain: (NodePattern | RelPattern)[] | NodePattern) {
    this.chain = Array.isArray(chain) ? chain : [chain];
  }

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitPatternElChain(this);
  }
}

export class NodePattern implements ASTNode {
  constructor(
    public variable: ASTIdentifier,
    public labels?: ASTIdentifier[],
    public props?: ASTMapLiteral | ASTParameter
  ) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitNodePattern(this);
  }
}

export class RelPattern implements ASTNode {
  constructor(
    public pointsLeft: boolean,
    public pointsRight: boolean,
    public variable?: ASTIdentifier,
    public types?: ASTIdentifier,
    public range?: [ASTNumberLiteral] | [ASTNumberLiteral, ASTNumberLiteral],
    public props?: ASTMapLiteral | ASTParameter
  ) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitRelPattern(this);
  }
}
