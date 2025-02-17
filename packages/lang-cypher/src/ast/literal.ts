import { ASTIdentifier, ASTLiteral, ASTNode } from '@dortdb/core';
import { CypherVisitor } from './visitor.js';
import { parseStringLiteral } from '../utils/string.js';

export class CypherIdentifier extends ASTIdentifier {
  constructor(
    public idOriginal: string,
    public schemaOriginal?: string,
  ) {
    super();
    if (!schemaOriginal) {
      [this.idOriginal, this.schemaOriginal] = this.splitId(idOriginal);
    }
    if (this.schemaOriginal) {
      this.parts.push(this.parseId(this.schemaOriginal));
    }
    this.parts.push(this.parseId(this.idOriginal));
  }

  override accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitCypherIdentifier(this, arg);
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
  constructor(original: string) {
    super(original, null);
    this.value = parseStringLiteral(original);
  }

  override accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitStringLiteral(this, arg);
  }
}

export class ASTNumberLiteral extends ASTLiteral<number> {
  constructor(original: string) {
    super(original, +original);
  }

  override accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitNumberLiteral(this, arg);
  }
}

export class ASTListLiteral implements ASTNode {
  constructor(public items: ASTNode[]) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitListLiteral(this, arg);
  }
}

export class ASTMapLiteral implements ASTNode {
  constructor(public items: [ASTIdentifier, ASTNode][]) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitMapLiteral(this, arg);
  }
}

export class ASTBooleanLiteral extends ASTLiteral<boolean | null> {
  constructor(original: string) {
    super(original, null);
    this.value = this.parse(original);
  }

  override accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitBooleanLiteral(this, arg);
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
