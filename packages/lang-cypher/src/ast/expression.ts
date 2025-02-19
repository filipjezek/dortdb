import { Aliased, ASTFunction, ASTNode } from '@dortdb/core';
import { CypherVisitor } from './visitor.js';
import { CypherIdentifier } from './literal.js';
import { PatternElChain } from './pattern.js';

export class FnCallWrapper implements ASTNode {
  public yieldItems: (CypherIdentifier | Aliased<CypherIdentifier>)[] | '*';
  public where: ASTNode;
  /** procedure is Cypher equivalent for table function */
  public procedure = false;

  constructor(
    public fn: ASTFunction,
    public distinct: boolean,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFnCallWrapper(this, arg);
  }
}

export class ExistsSubquery implements ASTNode {
  public query: ASTNode;
  public pattern: PatternElChain[];
  public where: ASTNode;

  constructor() {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitExistsSubquery(this, arg);
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
    public where?: ASTNode,
  ) {
    this.quantifier = quantifier.toLowerCase() as Quantifier;
  }

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitQuantifiedExpr(this, arg);
  }
}

export class ASTParameter extends CypherIdentifier {
  constructor(idOriginal: string) {
    super(idOriginal);
  }

  override accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitParameter(this, arg);
  }
}

export class PatternComprehension implements ASTNode {
  constructor(
    public pattern: PatternElChain,
    public where: ASTNode | undefined,
    public expr: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitPatternComprehension(this, arg);
  }
}

export class ListComprehension implements ASTNode {
  constructor(
    public variable: CypherIdentifier,
    public source: ASTNode,
    public where?: ASTNode,
    public expr?: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitListComprehension(this, arg);
  }
}

export class CaseExpr implements ASTNode {
  constructor(
    public expr: ASTNode | undefined,
    public whenThens: [ASTNode, ASTNode][],
    public elseExpr?: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitCaseExpr(this, arg);
  }
}

export class CountAll implements ASTNode {
  constructor() {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitCountAll(this, arg);
  }
}

export class LabelFilterExpr implements ASTNode {
  constructor(
    public expr: ASTNode,
    public labels: CypherIdentifier[],
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitLabelFilterExpr(this, arg);
  }
}

export class SubscriptExpr implements ASTNode {
  constructor(
    public expr: ASTNode,
    public subscript: [ASTNode] | [ASTNode, ASTNode],
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSubscriptExpr(this, arg);
  }
}

export class PropLookup implements ASTNode {
  constructor(
    public expr: ASTNode,
    public prop: CypherIdentifier,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitPropLookup(this, arg);
  }
}
