import {
  ASTLiteral,
  ASTNode,
  ASTIdentifier as ASTIdentifierAttrs,
} from '@dortdb/core';
import { SQLVisitor } from './visitor.js';
import { parseIdentifier, parseStringLiteral } from '../utils/string.js';

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

export class ASTArray implements ASTNode {
  constructor(public items: ASTNode[]) {}

  accept(visitor: SQLVisitor): void {
    visitor.visitArray(this);
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
