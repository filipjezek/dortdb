export function parseStringLiteral(original: string): string {
  if (original[0] === '$') {
    return parseDollarQuoted(original);
  }
  let value = '';
  const escRegex =
    /^[bfnrt\\]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[0-7]{1,3}/g;
  for (let i = 1; i < original.length - 1; i++) {
    const c = original[i];
    let match: RegExpMatchArray | null;
    if (c === '\\' && (match = original.slice(i).match(escRegex))) {
      i += match[0].length;
      value += interpretEscape(match[0]);
    } else if (c === '' && original[i + 1] === '') {
      i++;
      value += "'";
    } else {
      value += c;
    }
  }
  return value;
}

export function parseDollarQuoted(original: string): string {
  const second$ = original.indexOf('$', 1);
  return original.slice(second$ + 1, -second$ - 1);
}

export function interpretEscape(esc: string): string {
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

export function parseIdentifier(original: string): string {
  return original[0] === '"' || original[0] === '$'
    ? parseStringLiteral(original)
    : original.toLowerCase();
}
