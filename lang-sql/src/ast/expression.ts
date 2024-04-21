import { ASTLiteral } from '@dortdb/core';
import { SQLVisitor } from './visitor';

export class StringLiteral implements ASTLiteral<string> {
  public value: string;

  constructor(public original: string) {
    this.parse();
  }

  accept(visitor: SQLVisitor): void {
    visitor.visitStringLiteral(this);
  }

  private parse() {
    if (this.original[0] === '$') {
      return this.parseDolarQuoted();
    }
    this.value = '';
    const escRegex =
      /^[bfnrt\\]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[0-7]{1,3}/g;
    for (let i = 1; i < this.original.length - 1; i++) {
      const c = this.original[i];
      let match: RegExpMatchArray | null;
      if (c === '\\' && (match = this.original.slice(i).match(escRegex))) {
        i += match[0].length;
        this.value += this.interpretEscape(match[0]);
      } else if (c === '' && this.original[i + 1] === '') {
        i++;
        this.value += "'";
      } else {
        this.value += c;
      }
    }
  }

  private parseDolarQuoted() {
    const second$ = this.original.indexOf('$', 1);
    this.value = this.original.slice(second$ + 1, -second$ - 1);
  }

  private interpretEscape(esc: string) {
    let code: number;
    switch (esc[0]) {
      case 'b':
        return '\b';
      case 'f':
        return '\f';
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case '\\':
        return '\\';
      case 'x':
        code = parseInt(esc.slice(1), 16);
        return String.fromCharCode(code);
      case 'u':
      case 'U':
        code = parseInt(esc.slice(1), 16);
        return String.fromCodePoint(code);
      default:
        code = parseInt(esc, 8);
        if (isNaN(code)) {
          return esc;
        }
        return String.fromCharCode(code);
    }
  }
}

export class NumberLiteral implements ASTLiteral<number> {
  public value: number;

  constructor(public original: string) {
    this.value = +original;
  }

  accept(visitor: SQLVisitor): void {
    visitor.visitNumberLiteral(this);
  }
}
