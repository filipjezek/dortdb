import { Aliased, ASTIdentifier, ASTLiteral, ASTNode } from '@dortdb/core';
import { CypherVisitor } from './visitor.js';
import { parseStringLiteral } from '../utils/string.js';

export class CypherIdentifier extends ASTIdentifier {
  constructor(public idOriginal: string) {
    super();
    const originalParts = this.splitId(idOriginal);
    this.parts = originalParts.map((part) => this.parseId(part));
  }

  override accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitCypherIdentifier(this, arg);
  }

  protected parseId(id: string): string {
    if (id.startsWith('`') && id.endsWith('`')) {
      return id.replaceAll('`', '');
    }
    return id;
  }

  protected splitId(id: string): string[] {
    if (id[0] !== '`') {
      const dot = id.indexOf('.');
      if (dot !== -1) {
        return [id.slice(0, dot), ...this.splitId(id.slice(dot + 1))];
      }
      return [id];
    }
    for (let i = 1; i < id.length - 1; i++) {
      if (id[i] === '`') {
        if (id[i + 1] === '`') {
          i++;
        } else {
          return [id.slice(0, i), ...this.splitId(id.slice(i + 2))];
        }
      }
    }
    return [id];
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
  constructor(public items: Aliased<ASTNode>[]) {}

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

  protected parse(val: string) {
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
