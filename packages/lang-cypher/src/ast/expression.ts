import { Aliased, ASTFunction, ASTNode } from '@dortdb/core';
import { CypherVisitor } from './visitor.js';
import { CypherIdentifier } from './literal.js';
import { PatternElChain } from './pattern.js';

/**
 * Wraps a function or procedure call, carrying Cypher-specific modifiers
 * (DISTINCT, YIELD, WHERE) that plain {@link ASTFunction} does not model.
 */
export class FnCallWrapper implements ASTNode {
  /** YIELD items projected from a procedure call, or `'*'` to yield all columns. */
  public yieldItems: (CypherIdentifier | Aliased<CypherIdentifier>)[] | '*';
  /** WHERE filter applied to the rows yielded by a procedure call. */
  public where: ASTNode;
  /** procedure is Cypher equivalent for table function */
  public procedure = false;

  constructor(
    /** The underlying function or procedure being called. */
    public fn: ASTFunction,
    /** Whether the DISTINCT modifier eliminates duplicate argument values. */
    public distinct: boolean,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFnCallWrapper(this, arg);
  }
}

/**
 * An `EXISTS { ... }` predicate that is true when the inner query or pattern
 * returns at least one row.
 */
export class ExistsSubquery implements ASTNode {
  constructor(
    /** Full subquery body; null when using the pattern-only form. */
    public query: ASTNode,
    /** Inline path patterns for the pattern-only form; empty when a full query is present. */
    public pattern: PatternElChain[],
    /** Optional WHERE filter applied inside the EXISTS check. */
    public where: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitExistsSubquery(this, arg);
  }
}

/** Quantifier keyword for a {@link QuantifiedExpr}. */
export enum Quantifier {
  /** True when at least one element satisfies the predicate. */
  ANY = 'any',
  /** True when every element satisfies the predicate. */
  ALL = 'all',
  /** True when exactly one element satisfies the predicate. */
  SINGLE = 'single',
  /** True when no element satisfies the predicate. */
  NONE = 'none',
}
/**
 * Quantified list predicate of the form `ANY(x IN list WHERE predicate)`.
 */
export class QuantifiedExpr implements ASTNode {
  /** The quantifier keyword (lowercased from source). */
  public quantifier: Quantifier;

  constructor(
    quantifier: string,
    /** Iteration variable bound to each list element. */
    public variable: CypherIdentifier,
    /** The list expression to iterate over. */
    public expr: ASTNode,
    /** Predicate tested against each element; null when omitted. */
    public where: ASTNode = null,
  ) {
    this.quantifier = quantifier.toLowerCase() as Quantifier;
  }

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitQuantifiedExpr(this, arg);
  }
}

/**
 * Pattern comprehension `[(pattern) WHERE filter | projection]` that collects
 * matched paths into a list.
 */
export class PatternComprehension implements ASTNode {
  constructor(
    /** The graph pattern to match. */
    public pattern: PatternElChain,
    /** Optional WHERE filter; null if omitted. */
    public where: ASTNode,
    /** Projection expression applied to each match. */
    public expr: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitPatternComprehension(this, arg);
  }
}

/**
 * List comprehension `[variable IN source WHERE filter | projection]`.
 */
export class ListComprehension implements ASTNode {
  constructor(
    /** Iteration variable bound to each source element. */
    public variable: CypherIdentifier,
    /** List expression to iterate over. */
    public source: ASTNode,
    /** Optional filter predicate; null if omitted. */
    public where: ASTNode = null,
    /** Optional projection expression; null means each source element is returned as-is. */
    public expr: ASTNode = null,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitListComprehension(this, arg);
  }
}

/**
 * A CASE expression, either simple (with a subject `expr`) or searched (without).
 */
export class CaseExpr implements ASTNode {
  constructor(
    /** Subject expression for simple CASE; `undefined` for searched CASE. */
    public expr: ASTNode | undefined,
    /** Ordered list of `[when-condition, then-result]` pairs. */
    public whenThens: [ASTNode, ASTNode][],
    /** ELSE expression; `undefined` if no ELSE branch is present. */
    public elseExpr?: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitCaseExpr(this, arg);
  }
}

/** The `COUNT(*)` aggregate that counts all rows regardless of null values. */
export class CountAll implements ASTNode {
  constructor() {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitCountAll(this, arg);
  }
}

/**
 * Label filter predicate `expr:Label1:Label2:...` that tests whether a node or
 * relationship has all of the specified labels.
 */
export class LabelFilterExpr implements ASTNode {
  constructor(
    /** The node or relationship expression being tested. */
    public expr: ASTNode,
    /** Required labels; all must be present for the predicate to be true. */
    public labels: CypherIdentifier[],
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitLabelFilterExpr(this, arg);
  }
}

/**
 * Subscript or slice expression: `expr[idx]` for index access or
 * `expr[from..to]` for a range slice.
 */
export class SubscriptExpr implements ASTNode {
  constructor(
    /** The list or map being indexed. */
    public expr: ASTNode,
    /** Single-element tuple for index access; two-element tuple `[from, to]` for a slice. */
    public subscript: [ASTNode] | [ASTNode, ASTNode],
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSubscriptExpr(this, arg);
  }
}

/** Property access expression `expr.prop`. */
export class PropLookup implements ASTNode {
  constructor(
    /** The node, relationship, or map expression being accessed. */
    public expr: ASTNode,
    /** The property name to look up. */
    public prop: CypherIdentifier,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitPropLookup(this, arg);
  }
}
