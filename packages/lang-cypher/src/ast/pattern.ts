import { ASTIdentifier, ASTNode } from '@dortdb/core';
import { CypherVisitor } from './visitor.js';
import {
  CypherIdentifier,
  ASTMapLiteral,
  ASTNumberLiteral,
} from './literal.js';

export class PatternElChain implements ASTNode {
  public chain: (NodePattern | RelPattern)[];
  public variable?: CypherIdentifier;

  constructor(chain: (NodePattern | RelPattern)[] | NodePattern) {
    this.chain = Array.isArray(chain) ? chain : [chain];
  }

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitPatternElChain(this, arg);
  }
}

export class NodePattern implements ASTNode {
  constructor(
    public variable: CypherIdentifier | undefined,
    public labels: CypherIdentifier[] = [],
    public props?: ASTMapLiteral | ASTIdentifier,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitNodePattern(this, arg);
  }
}

export class RelPattern implements ASTNode {
  constructor(
    public pointsLeft: boolean,
    public pointsRight: boolean,
    public variable?: CypherIdentifier,
    public types: CypherIdentifier[] = [],
    public range?: [ASTNumberLiteral | undefined, ASTNumberLiteral | undefined],
    public props?: ASTMapLiteral | ASTIdentifier,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitRelPattern(this, arg);
  }
}
