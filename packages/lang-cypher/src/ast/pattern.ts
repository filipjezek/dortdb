import { ASTIdentifier, ASTNode } from '@dortdb/core';
import { CypherVisitor } from './visitor.js';
import {
  CypherIdentifier,
  ASTMapLiteral,
  ASTNumberLiteral,
} from './literal.js';

/**
 * A path pattern or named path, consisting of alternating {@link NodePattern}
 * and {@link RelPattern} elements.
 */
export class PatternElChain implements ASTNode {
  /** Alternating sequence of node and relationship patterns forming the path. */
  public chain: (NodePattern | RelPattern)[];
  /** Path variable bound to the whole chain; null if the path is unnamed. */
  public variable: CypherIdentifier = null;

  constructor(chain: (NodePattern | RelPattern)[] | NodePattern) {
    this.chain = Array.isArray(chain) ? chain : [chain];
  }

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitPatternElChain(this, arg);
  }
}

/** A node pattern `(variable:Label {props})`. */
export class NodePattern implements ASTNode {
  constructor(
    /** Optional node variable; null if the node is anonymous. */
    public variable: CypherIdentifier,
    /** Required node labels; empty if unconstrained. */
    public labels: CypherIdentifier[] = [],
    /** Property constraints as a map literal or parameter reference; null if none. */
    public props: ASTMapLiteral | ASTIdentifier = null,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitNodePattern(this, arg);
  }
}

/** A relationship pattern `-[variable:TYPE*range {props}]-`. */
export class RelPattern implements ASTNode {
  constructor(
    /** True when the arrow points left (`<-[...]-`). */
    public pointsLeft = false,
    /** True when the arrow points right (`-[...]->`); both false means undirected. */
    public pointsRight = false,
    /** Optional relationship variable; null if anonymous. */
    public variable: CypherIdentifier = null,
    /** Relationship type constraints; empty if unconstrained. */
    public types: CypherIdentifier[] = [],
    /**
     * Variable-length hop bounds `[min, max]`; `undefined` in either position means
     * unbounded on that side; null for a fixed-length (non-variable) relationship.
     */
    public range: [
      ASTNumberLiteral | undefined,
      ASTNumberLiteral | undefined,
    ] = null,
    /** Property constraints as a map literal or parameter reference; null if none. */
    public props: ASTMapLiteral | ASTIdentifier = null,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitRelPattern(this, arg);
  }
}
