// @vitest-environment jsdom
import { DortDB } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { DomDataAdapter, XQuery } from '@dortdb/lang-xquery';

describe('XQuery - quantified expressions', () => {
  const doc = new DOMParser().parseFromString('<root/>', 'text/xml');
  const db = new DortDB({
    mainLang: XQuery({ adapter: new DomDataAdapter(doc) }),
    optimizer: { rules: defaultRules },
  });

  it('should evaluate every over all elements matching', () => {
    const result = db.query('every $x in (1, 3, 5) satisfies $x > 0');
    expect(result.data).toEqual([true]);
  });

  it('should evaluate every over some elements not matching', () => {
    const result = db.query('every $x in (1, 3, -1, 5) satisfies $x > 0');
    expect(result.data).toEqual([false]);
  });

  it('should evaluate some over all elements not matching', () => {
    const result = db.query('some $x in (1, 3, 5) satisfies $x < 0');
    expect(result.data).toEqual([false]);
  });

  it('should evaluate some over some elements matching', () => {
    const result = db.query('some $x in (1, 3, -1, 5) satisfies $x < 0');
    expect(result.data).toEqual([true]);
  });
});
