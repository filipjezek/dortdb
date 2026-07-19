// @vitest-environment jsdom
import { DortDB } from '@dortdb/core';
import { XQuery, DomDataAdapter } from '@dortdb/lang-xquery';
import { defaultRules } from '@dortdb/core/optimizer';

describe('XQuery - hyphenated names', () => {
  const doc = new DOMParser().parseFromString('<root/>', 'text/xml');
  const db = new DortDB({
    mainLang: XQuery({ adapter: new DomDataAdapter(doc) }),
    optimizer: { rules: defaultRules },
  });

  it('should parse $x-2 as a single variable name', () => {
    const result = db.query('let $x := 5 return $x-2');
    expect(result.data).toEqual([undefined]);
  });

  it('should still evaluate subtraction when spaces are used', () => {
    const result = db.query('let $x := 5 return $x - 2');
    expect(result.data).toEqual([3]);
  });
});
