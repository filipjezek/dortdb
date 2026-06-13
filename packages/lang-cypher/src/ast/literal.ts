import { Aliased, ASTIdentifier, ASTLiteral, ASTNode } from '@dortdb/core';
import { CypherVisitor } from './visitor.js';
import { parseStringLiteral } from '../utils/string.js';

/**
 * Cypher identifier that handles backtick quoting and dot-separated qualified
 * names (e.g. `` `My Label` `` or `graph.node`).
 */
export class CypherIdentifier extends ASTIdentifier {
  constructor(
    /** Raw identifier text exactly as it appeared in the source, before parsing. */
    public idOriginal: string,
  ) {
    super();
    const originalParts = this.splitId(idOriginal);
    this.parts = originalParts.map((part) => this.parseId(part));
  }

  override accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitCypherIdentifier(this, arg);
  }

  /** Strips surrounding backtick delimiters from a single name part. */
  protected parseId(id: string): string {
    if (id.startsWith('`') && id.endsWith('`')) {
      return id.replaceAll('`', '');
    }
    return id;
  }

  /**
   * Splits a raw identifier string into individual name parts at unquoted dots,
   * respecting backtick-quoted segments that may themselves contain dots.
   */
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

/** String literal with Cypher escape sequences resolved into the final value. */
export class ASTStringLiteral extends ASTLiteral<string> {
  constructor(original: string) {
    super(original, null);
    this.value = parseStringLiteral(original);
  }

  override accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitStringLiteral(this, arg);
  }
}

/** Numeric literal whose `value` is the JavaScript number equivalent of the source text. */
export class ASTNumberLiteral extends ASTLiteral<number> {
  constructor(original: string) {
    super(original, +original);
  }

  override accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitNumberLiteral(this, arg);
  }
}

/** List literal `[item, ...]`. */
export class ASTListLiteral implements ASTNode {
  constructor(
    /** Ordered list of element expressions. */
    public items: ASTNode[],
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitListLiteral(this, arg);
  }
}

/** Map literal `{key: value, ...}`. */
export class ASTMapLiteral implements ASTNode {
  constructor(
    /** Key-value pairs where each alias is the string key name. */
    public items: Aliased<ASTNode>[],
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitMapLiteral(this, arg);
  }
}

/**
 * Boolean or `null` literal (`true`, `false`, or `null`); the parsed `value`
 * is `true`, `false`, or `null` accordingly.
 */
export class ASTBooleanLiteral extends ASTLiteral<boolean | null> {
  constructor(original: string) {
    super(original, null);
    this.value = this.parse(original);
  }

  override accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitBooleanLiteral(this, arg);
  }

  /**
   * Converts the source text to `true`, `false`, or `null` (case-insensitive);
   * returns `null` for any value other than `'true'` or `'false'`.
   */
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
