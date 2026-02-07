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

export class ASTStringLiteral extends ASTLiteral<string> {
  constructor(original: string) {
    super(original, null);
    this.value = parseStringLiteral(original);
  }

  override accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitStringLiteral(this, arg);
  }
}

export class SQLIdentifier extends ASTIdentifier {
  public schemasOriginal: string[];

  constructor(
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
  constructor(public items: ASTNode[] | ASTNode) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitArray(this, arg);
  }

  static fromString(str: string): ASTArray {
    // TODO
    return new ASTArray([]);
  }
}

/**
 * Immutable array, used for example in `IN` expressions.
 */
export class ASTTuple implements ASTNode {
  constructor(public items: ASTNode[]) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitTuple(this, arg);
  }
}

export class ASTRow implements ASTNode {
  constructor(public items: ASTExpressionAlias[] | ASTIdentifier) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitRow(this, arg);
  }
}

export class ASTCast implements ASTNode {
  constructor(
    public expr: ASTNode,
    public type: ASTIdentifier,
    public isArray = false,
  ) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitCast(this, arg);
  }
}

export class ASTSubscript implements ASTNode {
  constructor(
    public expr: ASTNode,
    public from: ASTNode,
    public to?: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSubscript(this, arg);
  }
}

export class ASTExists implements ASTNode {
  constructor(public query: ASTNode) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitExists(this, arg);
  }
}

export class ASTQuantifier implements ASTNode {
  public quantifier: plan.QuantifierType;
  public parentOp: string | ASTIdentifier;

  constructor(
    quantifier: string,
    public query: ASTNode,
  ) {
    this.quantifier = quantifier.toLowerCase() as plan.QuantifierType;
  }

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitQuantifier(this, arg);
  }
}

export class ASTCase implements ASTNode {
  constructor(
    public expr: ASTNode,
    public whenThen: [ASTNode, ASTNode][],
    public elseExpr: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitCase(this, arg);
  }
}

export class ASTAggregate extends ASTFunction {
  public distinct: boolean;

  constructor(
    id: SQLIdentifier,
    args: ASTNode[],
    distinct?: string,
    public orderBy?: OrderByItem[],
    public filter?: ASTNode,
    public withinGroupArgs?: OrderByItem[],
  ) {
    super('sql', id, args);
    this.distinct = distinct?.toLowerCase() === 'distinct';
  }

  override accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitAggregate(this, arg);
  }
}

export class ASTWindowFn extends ASTAggregate {
  constructor(
    id: SQLIdentifier,
    args: ASTNode[],
    public window: WindowSpec | ASTIdentifier,
    filter?: ASTNode,
  ) {
    super(id, args, null, null, filter);
  }

  override accept<Ret, Arg>(visitor: SQLVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitWindowFn(this, arg);
  }
}
