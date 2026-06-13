import { ASTLiteral, ASTNode, ASTIdentifier, boundParam } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { parseName, parseStringLiteral } from '../utils/string.js';
import { ASTItemType } from './item-type.js';
import { PathPredicate } from './path.js';

/**
 * XQuery string literal whose value has XQuery escape sequences (`""`, `''`, `&amp;`, etc.)
 * already resolved — `value` holds the decoded string, `original` holds the raw source text.
 */
export class ASTStringLiteral extends ASTLiteral<string> {
  constructor(original: string) {
    super(original, null);
    this.value = parseStringLiteral(original);
  }

  override accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitStringLiteral(this, arg);
  }
}

/** XQuery numeric literal; `value` holds the JavaScript `number` parsed from the source text. */
export class ASTNumberLiteral extends ASTLiteral<number> {
  constructor(original: string) {
    super(original, +original);
  }

  override accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitNumberLiteral(this, arg);
  }
}

/** An XQuery (possibly namespace-prefixed) name whose parts are split from the raw source text. */
export class XQueryIdentifier extends ASTIdentifier {
  constructor(
    /** The raw lexed name string (e.g. `"xs:integer"`); `parts` holds the split components. */
    public original: string,
  ) {
    super();
    if (!original) return;
    this.parts = parseName(original);
  }

  override accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitXQueryIdentifier(this, arg);
  }
}

/**
 * An XQuery variable reference (`$name`); `parts` holds the variable name components.
 *
 * @remarks `original` is always `null` — use `parts` to access the variable name.
 * If the first part is `"param"` it is replaced with the internal {@link boundParam} sentinel.
 */
export class ASTVariable extends XQueryIdentifier {
  constructor(name: XQueryIdentifier) {
    super(null);
    this.parts = name.parts;
    if (this.parts.length > 1 && this.parts[0] === 'param') {
      this.parts[0] = boundParam;
    }
  }

  override accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitVariable(this, arg);
  }
}

/** Whether a {@link QuantifiedExpr} requires all or at least one binding to satisfy the test. */
export enum Quantifier {
  /** All items in every bound sequence must satisfy the test expression. */
  EVERY = 'every',
  /** At least one item in any bound sequence must satisfy the test expression. */
  SOME = 'some',
}

/** XQuery quantified expression: `every/some $var in expr satisfies expr`. */
export class QuantifiedExpr implements ASTNode {
  constructor(
    /** Whether the expression uses `every` or `some`. */
    public quantifier: Quantifier,
    /** Pairs of (variable, sequence expression) being bound. */
    public variables: [ASTVariable, ASTNode][],
    /** The `satisfies` test expression evaluated for each binding combination. */
    public expr: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitQuantifiedExpr(this, arg);
  }
}

/** XQuery `switch` expression matching an operand against a set of case clauses. */
export class SwitchExpr implements ASTNode {
  constructor(
    /** The expression whose value is compared against each case. */
    public expr: ASTNode,
    /** Pairs of ([match expressions], result expression) for each `case` branch. */
    public cases: [ASTNode[], ASTNode][],
    /** The `default return` expression, evaluated when no case matches. */
    public defaultCase: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSwitchExpr(this, arg);
  }
}

/** XQuery `if (condition) then expr else expr` expression. */
export class IfExpr implements ASTNode {
  constructor(
    /** The boolean test expression. */
    public condition: ASTNode,
    /** Expression evaluated when `condition` is true. */
    public then: ASTNode,
    /** Expression evaluated when `condition` is false. */
    public elseExpr: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitIfExpr(this, arg);
  }
}

/** XPath/XQuery sequence-type occurrence indicator used in {@link ASTSequenceType}. */
export enum Occurence {
  /** Zero or one item (`?`). */
  ZERO_OR_ONE = '?',
  /** Zero or more items (`*`). */
  ZERO_OR_MORE = '*',
  /** One or more items (`+`). */
  ONE_OR_MORE = '+',
}

/** XQuery sequence type, e.g. `xs:integer*` or `element(foo)?`. */
export class ASTSequenceType implements ASTNode {
  constructor(
    /** The item type; `undefined` means `item()` (any single item). */
    public type?: ASTItemType,
    /** The occurrence indicator; `undefined` means exactly one item. */
    public occurrence?: string,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSequenceType(this, arg);
  }
}

/** XQuery `expr instance of SequenceType` type-test expression. */
export class InstanceOfExpr implements ASTNode {
  constructor(
    /** The expression being tested. */
    public expr: ASTNode,
    /** The sequence type to test against. */
    public type: ASTSequenceType,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitInstanceOfExpr(this, arg);
  }
}

/** XQuery `expr cast as AtomicType` expression. */
export class CastExpr implements ASTNode {
  constructor(
    /** The expression to cast. */
    public expr: ASTNode,
    /** The target atomic type name. */
    public type: XQueryIdentifier,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitCastExpr(this, arg);
  }
}

/** An expression filtered by a predicate, e.g. `expr[predicate]`. */
export class FilterExpr implements ASTNode {
  constructor(
    /** The base expression to filter. */
    public expr: ASTNode,
    /** The predicate applied to the base expression's result. */
    public predicate: PathPredicate,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFilterExpr(this, arg);
  }
}

/** XQuery comma-separated sequence constructor, e.g. `(a, b, c)`. */
export class SequenceConstructor implements ASTNode {
  constructor(
    /** The individual item expressions whose results are concatenated into a sequence. */
    public items: ASTNode[],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSequenceConstructor(this, arg);
  }
}

/** XQuery `ordered { ... }` or `unordered { ... }` expression for controlling evaluation ordering. */
export class OrderedExpr implements ASTNode {
  constructor(
    /** The child expressions wrapped by the ordering context. */
    public exprs: ASTNode[],
    /** `true` for an `ordered` block, `false` for an `unordered` block. */
    public ordered: boolean,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitOrderedExpr(this, arg);
  }
}
