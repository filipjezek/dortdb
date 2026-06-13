/** Parses a SQL string literal (single-quoted or dollar-quoted), expanding backslash escape sequences and `''` escapes. */
export function parseStringLiteral(original: string): string {
  if (original[0] === '$') {
    return parseDollarQuoted(original);
  }
  let value = '';
  const escRegex =
    /^([bfnrt\\]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[0-7]{1,3})/;
  for (let i = 1; i < original.length - 1; i++) {
    const c = original[i];
    let match: RegExpMatchArray | null;
    if (c === '\\' && (match = original.slice(i + 1).match(escRegex))) {
      i += match[0].length;
      value += interpretEscape(match[0]);
    } else if (c === "'" && original[i + 1] === "'") {
      i++;
      value += "'";
    } else {
      value += c;
    }
  }
  return value;
}

/** Extracts the body of a dollar-quoted string, stripping the opening and closing tag delimiters (e.g. `$tag$…$tag$`). */
export function parseDollarQuoted(original: string): string {
  const second$ = original.indexOf('$', 1);
  return original.slice(second$ + 1, -second$ - 1);
}

/** Translates a single SQL escape sequence (without the leading backslash) to its character value. */
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

/** Strips outer double-quote or backtick delimiters from a quoted identifier, unescaping doubled delimiter characters. */
export function parseIdentifier(original: string): string {
  const delim = original[0];
  if (delim === '"' || delim === '`') {
    return original.replaceAll(delim + delim, delim).slice(1, -1);
  }
  return original;
}

/** Converts a SQL `LIKE` pattern to a `RegExp`, mapping `%` to `.*` and `_` to `.`. */
export function likeToRegex(like: string, caseSensitive = true): RegExp {
  return new RegExp(
    '^' + like.replace(/%/g, '.*').replace(/_/g, '.') + '$',
    caseSensitive ? undefined : 'i',
  );
}
