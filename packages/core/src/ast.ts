import { AggregateCall } from './plan/operators/index.js';

/** Minimal shared interface for all AST expression nodes. */
export interface ASTNode {
  /** Dispatches this node to the matching method on `visitor`. */
  accept<Ret, Arg>(visitor: ASTVisitor<Ret, Arg>, arg?: Arg): Ret;
}

/** A literal constant value parsed from a query, carrying both the raw source text and the typed value. */
export class ASTLiteral<T> implements ASTNode {
  constructor(
    /** Raw source text of the literal as it appeared in the query. */
    public original: string,
    /** Parsed runtime value. */
    public value: T,
  ) {}

  /** {@inheritDoc ASTNode.accept} */
  accept<Ret, Arg>(visitor: ASTVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitLiteral(this, arg);
  }
}

/** A language-specific operator application node (infix, prefix, or postfix). */
export class ASTOperator implements ASTNode {
  constructor(
    /** Language this operator belongs to. */
    public lang: Lowercase<string>,
    /** Identifier that resolves to the operator implementation. */
    public id: ASTIdentifier,
    /** Operand expressions in source order. */
    public operands: ASTNode[],
  ) {}

  /** {@inheritDoc ASTNode.accept} */
  accept<Ret, Arg>(visitor: ASTVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitOperator(this, arg);
  }
}

/** A language-specific function call node. */
export class ASTFunction implements ASTNode {
  constructor(
    /** Language this function belongs to. */
    public lang: Lowercase<string>,
    /** Identifier that resolves to the function implementation. */
    public id: ASTIdentifier,
    /** Argument expressions in source order. */
    public args: ASTNode[],
  ) {}

  /** {@inheritDoc ASTNode.accept} */
  accept<Ret, Arg>(visitor: ASTVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFunction(this, arg);
  }
}

/** Symbol used as an identifier part to represent a wildcard "all attributes" reference (e.g. `SELECT *`). */
export const allAttrs = Symbol('all attrs');
/** Symbol used as an identifier part to mark a bound query parameter placeholder. */
export const boundParam = Symbol('bound param');

/**
 * A (possibly qualified) identifier representing a variable, column reference, or similar name.
 *
 * @remarks Parts run from most general to most specific (e.g. `[schema, table, column]`).
 */
export class ASTIdentifier implements ASTNode {
  /** Set when this identifier refers to an aggregate call in a GROUP BY context. */
  public aggregate?: AggregateCall;

  /** Ordered sequence of name parts that form the qualified identifier. */
  public parts: (string | symbol | number)[] = [];
  /** Iterates over {@link parts} in order. */
  [Symbol.iterator]() {
    return this.parts[Symbol.iterator]();
  }

  /** {@inheritDoc ASTNode.accept} */
  accept<Ret, Arg>(visitor: ASTVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitIdentifier(this, arg);
  }

  /** Creates an {@link ASTIdentifier} from a pre-built parts array. */
  static fromParts(parts: (string | symbol | number)[]): ASTIdentifier {
    const ret = new ASTIdentifier();
    ret.parts = parts;
    return ret;
  }

  /** Returns `true` when `other` has the same parts in the same order. */
  public equals(other: ASTIdentifier): boolean {
    if (this.parts.length !== other.parts.length) return false;
    for (let i = 0; i < this.parts.length; i++) {
      if (this.parts[i] !== other.parts[i]) return false;
    }
    return true;
  }
}

/**
 * An AST node that delegates query interpretation to a different language.
 *
 * @throws {Error} If `nodes` does not contain exactly one statement.
 */
export class LangSwitch implements ASTNode {
  /** The inner AST node to be processed by the target {@link lang}. */
  public node: ASTNode;
  constructor(
    /** Target language to switch to for the embedded expression. */
    public lang: Lowercase<string>,
    nodes: ASTNode[],
  ) {
    if (nodes.length !== 1)
      throw new Error('LangSwitch must contain exactly one statement');
    this.node = nodes[0];
  }

  /** {@inheritDoc ASTNode.accept} */
  accept<Ret, Arg>(visitor: ASTVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitLangSwitch(this, arg);
  }
}

/** Double-dispatch visitor for the core AST expression node types. */
export interface ASTVisitor<Ret, Arg = never> {
  visitLiteral<T>(node: ASTLiteral<T>, arg?: Arg): Ret;
  visitOperator(node: ASTOperator, arg?: Arg): Ret;
  visitFunction(node: ASTFunction, arg?: Arg): Ret;
  visitLangSwitch(node: LangSwitch, arg?: Arg): Ret;
  visitIdentifier(node: ASTIdentifier, arg?: Arg): Ret;
}
