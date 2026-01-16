import { ASTIdentifier, ASTNode } from '@dortdb/core';
import { CypherVisitor } from './visitor.js';
import {
  CypherIdentifier,
  ASTMapLiteral,
  ASTNumberLiteral,
} from './literal.js';

export class PatternElChain implements ASTNode {
  public chain: (NodePattern | RelPattern)[];
  public variable: CypherIdentifier = null;

  constructor(chain: (NodePattern | RelPattern)[] | NodePattern) {
    this.chain = Array.isArray(chain) ? chain : [chain];
  }

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitPatternElChain(this, arg);
  }
}

export class NodePattern implements ASTNode {
  constructor(
    public variable: CypherIdentifier,
    public labels: CypherIdentifier[] = [],
    public props: ASTMapLiteral | ASTIdentifier = null,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitNodePattern(this, arg);
  }
}

export class RelPattern implements ASTNode {
  constructor(
    public pointsLeft = false,
    public pointsRight = false,
    public variable: CypherIdentifier = null,
    public types: CypherIdentifier[] = [],
    public range: [
      ASTNumberLiteral | undefined,
      ASTNumberLiteral | undefined,
    ] = null,
    public props: ASTMapLiteral | ASTIdentifier = null,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitRelPattern(this, arg);
  }
}
