import {
  ASTLiteral,
  ASTNode,
  ASTIdentifier,
  ASTFunction,
  allAttrs,
  ASTVisitor,
} from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import { SQLVisitor } from './visitor.js';
import { parseIdentifier, parseStringLiteral } from '../utils/string.js';
import { OrderByItem } from './select.js';
import { WindowSpec } from './window.js';
import { ASTExpressionAlias } from './alias.js';

/**
 * SQL string literal, with escape sequences resolved into a JavaScript string.
 */
export class ASTStringLiteral extends ASTLiteral<string> {
  constructor(original: string) {
    super(original, null);
    this.value = parseStringLiteral(original);
  }

  override accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitStringLiteral(this, arg);
  }
}

/**
 * SQL identifier that preserves the original casing alongside the normalized form
 * and carries optional schema qualifiers.
 */
export class SQLIdentifier extends ASTIdentifier {
  /** Schema qualifiers as written in SQL source, ordered from least to most specific. */
  public schemasOriginal: string[];

  constructor(
    /** The identifier token as written in SQL source, before normalization; may be `allAttrs` for `*`. */
    public idOriginal: string | typeof allAttrs,
    /** from least to most specific */
    ...schemasOriginal: string[]
  ) {
    super();
    this.schemasOriginal = schemasOriginal;
    this.parts =
      idOriginal === allAttrs ? [idOriginal] : [parseIdentifier(idOriginal)];
    this.parts.unshift(
      ...schemasOriginal.filter((x) => !!x).map(parseIdentifier),
    );
  }

  override accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSQLIdentifier(this, arg);
  }
}

/**
 * SQL numeric literal with its value pre-parsed as a JavaScript number.
 */
export class ASTNumberLiteral extends ASTLiteral<number> {
  constructor(original: string) {
    super(original, +original);
  }

  override accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitNumberLiteral(this, arg);
  }
}

/**
 * Represents PostgreSQL array literal
 *
 * Can be created either from a list of items, from a string or from a subquery
 */
export class ASTArray implements ASTNode {
  constructor(
    /** The array contents: a list of element expressions or a single subquery node. */
    public items: ASTNode[] | ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitArray(this, arg);
  }

  /**
   * Parses a PostgreSQL array literal string into an {@link ASTArray}.
   *
   * @remarks Not yet implemented - always returns an empty array.
   */
  static fromString(str: string): ASTArray {
    // TODO
    return new ASTArray([]);
  }
}

/**
 * Immutable array, used for example in `IN` expressions.
 */
export class ASTTuple implements ASTNode {
  constructor(
    /** The tuple elements. */
    public items: ASTNode[],
  ) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitTuple(this, arg);
  }
}

/**
 * SQL `ROW(...)` constructor; wraps each element in an {@link ASTExpressionAlias}
 * with an auto-assigned column name.
 */
export class ASTRow implements ASTNode {
  /** Columns of the row, each wrapped in an {@link ASTExpressionAlias}. */
  public items: ASTExpressionAlias[];
  constructor(items: ASTNode[]) {
    this.items = items.map((item, i) => {
      if (item instanceof ASTExpressionAlias) {
        return item;
      } else if (item instanceof ASTIdentifier) {
        return new ASTExpressionAlias(item, item.parts.at(-1) as string);
      } else {
        return new ASTExpressionAlias(item, `col${i + 1}`);
      }
    });
  }

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitRow(this, arg);
  }
}

/**
 * SQL `CAST(expr AS type)` expression.
 */
export class ASTCast implements ASTNode {
  constructor(
    /** The expression being cast. */
    public expr: ASTNode,
    /** The target data type. */
    public type: ASTIdentifier,
    /** `true` when the cast target is an array type (`type[]`). */
    public isArray = false,
  ) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitCast(this, arg);
  }
}

/**
 * Array subscript or slice expression (`expr[from]` or `expr[from:to]`).
 */
export class ASTSubscript implements ASTNode {
  constructor(
    /** The array-valued expression being subscripted. */
    public expr: ASTNode,
    /** Lower bound (1-based) of the subscript or slice. */
    public from: ASTNode,
    /** Upper bound of the slice; `undefined` for a plain element subscript. */
    public to?: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSubscript(this, arg);
  }
}

/**
 * SQL `EXISTS(subquery)` predicate.
 */
export class ASTExists implements ASTNode {
  constructor(
    /** The subquery whose existence is tested. */
    public query: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitExists(this, arg);
  }
}

/**
 * SQL quantified comparison: `expr op ANY/ALL(subquery)` or `expr op ANY/ALL(array)`.
 */
export class ASTQuantifier implements ASTNode {
  /** Whether this is an `ANY` or `ALL` quantifier. */
  public quantifier: plan.QuantifierType;
  /** The comparison operator applied before the quantifier; set by the planner after parsing. */
  public parentOp: string | ASTIdentifier;

  constructor(
    quantifier: string,
    /** The subquery or array expression whose elements are compared. */
    public query: ASTNode,
  ) {
    this.quantifier = quantifier.toLowerCase() as plan.QuantifierType;
  }

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitQuantifier(this, arg);
  }
}

/**
 * SQL `CASE` expression.
 */
export class ASTCase implements ASTNode {
  constructor(
    /** The value compared against `WHEN` conditions (simple `CASE`); `null` for a searched `CASE`. */
    public expr: ASTNode,
    /** Ordered list of `[condition, result]` pairs. */
    public whenThen: [ASTNode, ASTNode][],
    /** The `ELSE` expression; `null` when no `ELSE` clause is present. */
    public elseExpr: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitCase(this, arg);
  }
}

/**
 * SQL aggregate function call, extending {@link ASTFunction} with aggregate-specific modifiers.
 */
export class ASTAggregate extends ASTFunction {
  /** `true` when the `DISTINCT` keyword was present, so duplicate inputs are discarded. */
  public distinct: boolean;

  constructor(
    id: SQLIdentifier,
    args: ASTNode[],
    distinct?: string,
    /** Per-aggregate `ORDER BY` clause; `undefined` for unordered aggregates. */
    public orderBy?: OrderByItem[],
    /** Optional `FILTER (WHERE ...)` predicate applied before aggregation. */
    public filter?: ASTNode,
    /** Ordering for ordered-set aggregate functions (`WITHIN GROUP (ORDER BY ...)`). */
    public withinGroupArgs?: OrderByItem[],
  ) {
    super('sql', id, args);
    this.distinct = distinct?.toLowerCase() === 'distinct';
  }

  override accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitAggregate(this, arg);
  }
}

/**
 * Window function call, extending {@link ASTAggregate} with a window specification.
 */
export class ASTWindowFn extends ASTAggregate {
  constructor(
    id: SQLIdentifier,
    args: ASTNode[],
    /** The window specification or reference to a named window defined in the `WINDOW` clause. */
    public window: WindowSpec | ASTIdentifier,
    filter?: ASTNode,
  ) {
    super(id, args, null, null, filter);
  }

  override accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitWindowFn(this, arg);
  }
}
