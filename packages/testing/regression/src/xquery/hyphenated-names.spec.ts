// @vitest-environment jsdom
import { DortDB } from '@dortdb/core';
import { XQuery, DomDataAdapter } from '@dortdb/lang-xquery';
import { defaultRules } from '@dortdb/core/optimizer';

// XQuery names (NCNames) may contain hyphens: `$x-2` references a variable
// literally named 'x-2', and evaluating it when only $x is bound is a static
// error (XPST0008; fontoxpath throws). DortDB tokenizes `$x-2` as `$x - 2` and
// silently returns 3 - masking typos with wrong results. The same lexing issue
// breaks all hyphenated function names (string-length, normalize-space, ...).
describe('XQuery - hyphenated names', () => {
  const doc = new DOMParser().parseFromString('<root/>', 'text/xml');
  const db = new DortDB({
    mainLang: XQuery({ adapter: new DomDataAdapter(doc) }),
    optimizer: { rules: defaultRules },
  });

  it('should parse $x-2 as a single variable name', () => {
    expect(() => db.query('let $x := 5 return $x-2')).toThrow();
  });

  it('should still evaluate subtraction when spaces are used', () => {
    const result = db.query('let $x := 5 return $x - 2');
    expect(result.data).toEqual([3]);
  });
});
