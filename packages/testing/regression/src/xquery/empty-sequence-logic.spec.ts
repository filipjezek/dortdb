// @vitest-environment jsdom
import { DortDB } from '@dortdb/core';
import { XQuery, DomDataAdapter } from '@dortdb/lang-xquery';
import { defaultRules } from '@dortdb/core/optimizer';

describe('XQuery - empty sequence in boolean contexts', () => {
  const doc = new DOMParser().parseFromString('<root/>', 'text/xml');
  const db = new DortDB({
    mainLang: XQuery({ adapter: new DomDataAdapter(doc) }),
    optimizer: { rules: defaultRules },
  });

  it('should evaluate () and true() as false', () => {
    const result = db.query('() and true()');
    expect(result.data).toEqual([false]);
  });

  it('should evaluate () or true() as true', () => {
    const result = db.query('() or true()');
    expect(result.data).toEqual([true]);
  });

  it('should evaluate some over an empty sequence as false', () => {
    const result = db.query('some $x in () satisfies $x > 0');
    expect(result.data).toEqual([false]);
  });

  it('should evaluate every over an empty sequence as true', () => {
    const result = db.query('every $x in () satisfies $x > 0');
    expect(result.data).toEqual([true]);
  });
});
