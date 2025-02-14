import {
  ASTLiteral,
  ASTNode,
  ASTIdentifier,
  ASTFunction,
  allAttrs,
} from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import { SQLVisitor } from './visitor.js';
import { parseIdentifier, parseStringLiteral } from '../utils/string.js';
import { OrderByItem } from './select.js';
import { WindowSpec } from './window.js';

export class ASTStringLiteral extends ASTLiteral<string> {
  constructor(original: string) {
    super(original, null);
    this.value = parseStringLiteral(original);
  }

  override accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitStringLiteral(this);
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
    this.parts =
      idOriginal === allAttrs ? [idOriginal] : [parseIdentifier(idOriginal)];
    this.parts.unshift(
      ...schemasOriginal.filter((x) => !!x).map(parseIdentifier)
    );
  }

  override accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitSQLIdentifier(this);
  }
}

export class ASTNumberLiteral extends ASTLiteral<number> {
  constructor(original: string) {
    super(original, +original);
  }

  override accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitNumberLiteral(this);
  }
}

/**
 * Represents PostgreSQL array literal
 *
 * Can be created either from a list of items, from a string or from a subquery
 */
export class ASTArray implements ASTNode {
  constructor(public items: ASTNode[] | ASTNode) {}

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitArray(this);
  }

  static fromString(str: string): ASTArray {
    // TODO
    return new ASTArray([]);
  }
}

export class ASTRow implements ASTNode {
  constructor(public items: ASTNode[]) {}

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitRow(this);
  }
}

export class ASTParam implements ASTNode {
  constructor(public name: string) {}

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitParam(this);
  }
}

export class ASTCast implements ASTNode {
  constructor(
    public expr: ASTNode,
    public type: ASTIdentifier,
    public isArray = false
  ) {}

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitCast(this);
  }
}

export class ASTSubscript implements ASTNode {
  constructor(
    public expr: ASTNode,
    public from: ASTNode,
    public to?: ASTNode
  ) {}

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitSubscript(this);
  }
}

export class ASTExists implements ASTNode {
  constructor(public query: ASTNode) {}

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitExists(this);
  }
}

export class ASTQuantifier implements ASTNode {
  public quantifier: plan.QuantifierType;
  public parentOp: string | ASTIdentifier;

  constructor(quantifier: string, public query: ASTNode) {
    this.quantifier = quantifier.toLowerCase() as plan.QuantifierType;
  }

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitQuantifier(this);
  }
}

export class ASTCase implements ASTNode {
  constructor(
    public expr: ASTNode | undefined,
    public whenThen: [ASTNode, ASTNode][],
    public elseExpr: ASTNode
  ) {}

  accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitCase(this);
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
    public withinGroupArgs?: OrderByItem[]
  ) {
    super('sql', id, args);
    this.distinct = distinct?.toLowerCase() === 'distinct';
  }

  override accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitAggregate(this);
  }
}

export class ASTWindowFn extends ASTAggregate {
  constructor(
    id: SQLIdentifier,
    args: ASTNode[],
    public window: WindowSpec | ASTIdentifier,
    filter?: ASTNode
  ) {
    super(id, args, null, null, filter);
  }

  override accept<T>(visitor: SQLVisitor<T>): T {
    return visitor.visitWindowFn(this);
  }
}
