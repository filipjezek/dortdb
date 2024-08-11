import {
  ASTLiteral,
  ASTNode,
  ASTIdentifier as ASTIdentifierAttrs,
  ASTFunction,
} from '@dortdb/core';
import { SQLVisitor } from './visitor.js';
import { parseIdentifier, parseStringLiteral } from '../utils/string.js';
import { OrderByItem } from './select.js';
import { WindowSpec } from './window.js';

export class ASTStringLiteral extends ASTLiteral<string> {
  constructor(public original: string) {
    super(original, null);
    this.value = parseStringLiteral(original);
  }

  accept(visitor: SQLVisitor): void {
    visitor.visitStringLiteral(this);
  }
}

export class ASTIdentifier implements ASTNode, ASTIdentifierAttrs {
  public id: string;
  public schema: string;

  constructor(public idOriginal: string, public schemaOriginal?: string) {
    this.id = parseIdentifier(idOriginal);
    this.schema = schemaOriginal && parseIdentifier(schemaOriginal);
  }

  accept(visitor: SQLVisitor): void {
    visitor.visitIdentifier(this);
  }
}

export class ASTNumberLiteral extends ASTLiteral<number> {
  constructor(public original: string) {
    super(original, +original);
  }

  override accept(visitor: SQLVisitor): void {
    visitor.visitNumberLiteral(this);
  }
}

/**
 * Represents PostgreSQL array literal
 *
 * Can be created either from a list of items, from a string or from a subquery
 */
export class ASTArray implements ASTNode {
  constructor(public items: ASTNode[] | ASTNode) {}

  accept(visitor: SQLVisitor): void {
    visitor.visitArray(this);
  }

  static fromString(str: string): ASTArray {
    // TODO
    return new ASTArray([]);
  }
}

export class ASTRow implements ASTNode {
  constructor(public items: ASTNode[]) {}

  accept(visitor: SQLVisitor): void {
    visitor.visitRow(this);
  }
}

export class ASTParam implements ASTNode {
  constructor(public name: string) {}

  accept(visitor: SQLVisitor): void {
    visitor.visitParam(this);
  }
}

export class ASTCast implements ASTNode {
  constructor(public expr: ASTNode, public type: string, isArray = false) {}

  accept(visitor: SQLVisitor): void {
    visitor.visitCast(this);
  }
}

export class ASTSubscript implements ASTNode {
  constructor(public expr: ASTNode, public from: ASTNode, public to: ASTNode) {}

  accept(visitor: SQLVisitor): void {
    visitor.visitSubscript(this);
  }
}

export class ASTExists implements ASTNode {
  constructor(public query: ASTNode) {}

  accept(visitor: SQLVisitor): void {
    visitor.visitExists(this);
  }
}

export enum QuantifierType {
  ALL = 'all',
  ANY = 'any',
}
export class ASTQuantifier implements ASTNode {
  constructor(public quantifier: string, public query: ASTNode) {
    this.quantifier = quantifier.toLowerCase() as QuantifierType;
  }

  accept(visitor: SQLVisitor): void {
    visitor.visitQuantifier(this);
  }
}

export class ASTCase implements ASTNode {
  constructor(
    public expr: ASTNode | null,
    public whenThen: [ASTNode, ASTNode][],
    public elseExpr: ASTNode
  ) {}

  accept(visitor: SQLVisitor): void {
    visitor.visitCase(this);
  }
}

export class ASTAggregate extends ASTFunction {
  public distinct: boolean;

  constructor(
    id: ASTIdentifier,
    args: ASTNode[],
    distinct?: string,
    public orderBy?: OrderByItem[],
    public filter?: ASTNode,
    public withinGroupArgs?: ASTNode[]
  ) {
    super('sql', id, args);
    this.distinct = distinct?.toLowerCase() === 'distinct';
  }

  override accept(visitor: SQLVisitor): void {
    visitor.visitAggregate(this);
  }
}

export class ASTWindowFn extends ASTAggregate {
  constructor(
    id: ASTIdentifier,
    args: ASTNode[],
    public window: WindowSpec | string,
    filter?: ASTNode
  ) {
    super(id, args, null, null, filter);
  }

  override accept(visitor: SQLVisitor): void {
    visitor.visitWindowFn(this);
  }
}
