import { ASTFunction, ASTNode } from '@dortdb/core';
import { CypherVisitor } from './visitor.js';
import { CypherIdentifier } from './literal.js';
import { PatternElChain } from './pattern.js';

export class FnCallWrapper implements ASTNode {
  /**
   * Yield items can be a single identifier, a pair of identifiers (1st AS 2nd), or a wildcard.
   */
  public yieldItems:
    | (CypherIdentifier | [CypherIdentifier, CypherIdentifier])[]
    | '*';
  public where: ASTNode;

  constructor(public fn: ASTFunction, public distinct: boolean) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitFnCallWrapper(this);
  }
}

export class ExistsSubquery implements ASTNode {
  public query: ASTNode;
  public pattern: PatternElChain[];
  public where: ASTNode;

  constructor() {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitExistsSubquery(this);
  }
}

export enum Quantifier {
  ANY = 'any',
  ALL = 'all',
  SINGLE = 'single',
  NONE = 'none',
}
export class QuantifiedExpr implements ASTNode {
  public quantifier: Quantifier;

  constructor(
    quantifier: string,
    public variable: CypherIdentifier,
    public expr: ASTNode,
    public where?: ASTNode
  ) {
    this.quantifier = quantifier.toLowerCase() as Quantifier;
  }

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitQuantifiedExpr(this);
  }
}

export class ASTParameter extends CypherIdentifier {
  constructor(idOriginal: string) {
    super(idOriginal);
  }

  override accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitParameter(this);
  }
}

export class PatternComprehension implements ASTNode {
  constructor(
    public pattern: PatternElChain,
    public where: ASTNode | undefined,
    public expr: ASTNode
  ) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitPatternComprehension(this);
  }
}

export class ListComprehension implements ASTNode {
  constructor(
    public variable: CypherIdentifier,
    public source: ASTNode,
    public where?: ASTNode,
    public expr?: ASTNode
  ) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitListComprehension(this);
  }
}

export class CaseExpr implements ASTNode {
  constructor(
    public expr: ASTNode | undefined,
    public whenThens: [ASTNode, ASTNode][],
    public elseExpr?: ASTNode
  ) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitCaseExpr(this);
  }
}

export class CountAll implements ASTNode {
  constructor() {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitCountAll(this);
  }
}

export class LabelFilterExpr implements ASTNode {
  constructor(public expr: ASTNode, public labels: CypherIdentifier[]) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitLabelFilterExpr(this);
  }
}

export class SubscriptExpr implements ASTNode {
  constructor(
    public expr: ASTNode,
    public subscript: [ASTNode] | [ASTNode, ASTNode]
  ) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitSubscriptExpr(this);
  }
}

export class PropLookup implements ASTNode {
  constructor(public expr: ASTNode, public prop: CypherIdentifier) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitPropLookup(this);
  }
}
