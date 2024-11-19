import {
  ASTIdentifier as ASTIdentAttrs,
  ASTLiteral,
  ASTNode,
  ASTVisitor,
} from '@dortdb/core';
import { CypherVisitor } from './visitor.js';
import { parseStringLiteral } from '../utils/string.js';

export class ASTIdentifier implements ASTIdentAttrs {
  public schema?: string;
  public id: string;

  constructor(public idOriginal: string, public schemaOriginal?: string) {
    if (!schemaOriginal) {
      [idOriginal, schemaOriginal] = this.splitId(idOriginal);
    }
    this.id = this.parseId(idOriginal);
    this.schema = schemaOriginal && this.parseId(schemaOriginal);
  }

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitIdentifier(this);
  }

  private parseId(id: string): string {
    if (id.startsWith('`') && id.endsWith('`')) {
      return id.replaceAll('`', '');
    }
    return id;
  }

  private splitId(id: string): [string, string] {
    if (id[0] !== '`') {
      const dot = id.indexOf('.');
      if (dot !== -1) {
        return [id.slice(0, dot), id.slice(dot + 1)];
      }
      return [id, undefined];
    }
    for (let i = 1; i < id.length - 1; i++) {
      if (id[i] === '`') {
        if (id[i + 1] === '`') {
          i++;
        } else {
          return [id.slice(0, i), id.slice(i + 2)];
        }
      }
    }
    return [id, undefined];
  }
}

export class ASTStringLiteral extends ASTLiteral<string> {
  constructor(public original: string) {
    super(original, null);
    this.value = parseStringLiteral(original);
  }

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitStringLiteral(this);
  }
}

export class ASTNumberLiteral extends ASTLiteral<number> {
  constructor(public original: string) {
    super(original, +original);
  }

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitNumberLiteral(this);
  }
}

export class ASTListLiteral implements ASTNode {
  constructor(public items: ASTNode[]) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitListLiteral(this);
  }
}

export class ASTMapLiteral implements ASTNode {
  constructor(public items: [ASTIdentifier, ASTNode][]) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitMapLiteral(this);
  }
}

export class ASTBooleanLiteral extends ASTLiteral<boolean | null> {
  constructor(public original: string) {
    super(original, null);
    this.value = this.parse(original);
  }

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitBooleanLiteral(this);
  }

  private parse(val: string) {
    const lc = val.toLowerCase();
    if (lc === 'true') {
      return true;
    }
    if (lc === 'false') {
      return false;
    }
    return null;
  }
}
