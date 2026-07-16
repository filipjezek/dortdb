// @vitest-environment jsdom
import { DortDB } from '@dortdb/core';
import { XQuery, DomDataAdapter } from '@dortdb/lang-xquery';
import { defaultRules } from '@dortdb/core/optimizer';

// XQuery 3.0 reference (verified with fontoxpath): the effective boolean value
// of () is false, so
//   () and true()                     -> false
//   () or true()                      -> true
//   some $x in () satisfies $x > 0    -> false  (every ... -> true)
// DortDB returns true, an empty sequence, and true respectively.
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
});
