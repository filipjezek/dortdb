import { ASTIdentifier } from '@dortdb/core';

/**
 * Unquotes an XQuery string literal, handling doubled-delimiter escapes and
 * XML character-reference / predefined entity sequences.
 */
export function parseStringLiteral(original: string): string {
  const delim = original[0];
  let value = '';
  const escRegex = /^([a-z]+|#[0-9]+|#x[0-9a-fA-F]+);/;
  for (let i = 1; i < original.length - 1; i++) {
    const c = original[i];
    let match: RegExpMatchArray | null;
    if (c === '&' && (match = original.slice(i + 1).match(escRegex))) {
      i += match[0].length;
      value += interpretEscape(match[1]);
    } else if (c === delim && original[i + 1] === delim) {
      i++;
      value += delim;
    } else {
      value += c;
    }
  }
  return value;
}

/**
 * Decodes a single XML/XQuery escape sequence (numeric `#N` / hex `#xN` code
 * point, or a named entity such as `lt`, `gt`, `amp`, `quot`, `apos`).
 * Unknown names are returned verbatim as `&name;`.
 */
export function interpretEscape(esc: string): string {
  if (esc[0] === '#') {
    if (esc[1] === 'x') {
      return String.fromCodePoint(parseInt(esc.slice(2), 16));
    }
    return String.fromCodePoint(parseInt(esc.slice(1), 10));
  }
  switch (esc) {
    case 'lt':
      return '<';
    case 'gt':
      return '>';
    case 'amp':
      return '&';
    case 'quot':
      return '"';
    case 'apos':
      return "'";
    default:
      return `&${esc};`;
  }
}

/**
 * Splits an XQuery QName or braced URI literal into its parts: `[ns, local]`
 * for `Q{uri}local` notation, or `[prefix, local]` for `prefix:local`, or
 * `[local]` for an unprefixed name.
 */
export function parseName(original: string): string[] {
  if (original.startsWith('Q{')) {
    const end = original.indexOf('}');
    return [original.slice(2, end), original.slice(end + 1)];
  }
  const parts = original.split(':');
  return parts;
}

/**
 * Serializes an {@link ASTIdentifier} back to a prefixed QName string
 * (`prefix:local` when a namespace part is present, otherwise just `local`).
 */
export function idToStr(id: ASTIdentifier): string {
  let res = '';
  if (id.parts.length > 1) {
    res += id.parts.at(-2).toString() + ':';
  }
  res += id.parts.at(-1).toString();
  return res;
}
