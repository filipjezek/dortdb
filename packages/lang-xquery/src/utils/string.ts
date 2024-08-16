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

export function parseName(original: string): [string, string] {
  if (original.startsWith('Q{')) {
    const end = original.indexOf('}');
    return [original.slice(2, end), original.slice(end + 1)];
  }
  const parts = original.split(':');
  return parts.length === 1 ? ['', parts[0]] : [parts[0], parts[1]];
}
