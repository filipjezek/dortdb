// @vitest-environment jsdom
import { DortDB } from '@dortdb/core';
import { XQuery, DomDataAdapter } from '@dortdb/lang-xquery';
import { defaultRules } from '@dortdb/core/optimizer';

// XQuery 3.0 reference (verified with fontoxpath):
//   sum($doc/catalog/book/@price) -> 50   (attributes atomize to numbers)
//   sum(())                       -> 0
// DortDB concatenates the Attr objects into the string
// '[object Attr][object Attr][object Attr]' and returns null for sum(()).
// The docs promise aggregate arguments are atomized by default.
describe('XQuery - aggregate atomization', () => {
  const doc = new DOMParser().parseFromString(
    `<catalog>
      <book id="b1" price="10"/>
      <book id="b2" price="25"/>
      <book id="b3" price="15"/>
    </catalog>`,
    'text/xml',
  );
  const db = new DortDB({
    mainLang: XQuery({ adapter: new DomDataAdapter(doc) }),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['doc'], doc);

  it('should atomize attribute nodes passed to sum()', () => {
    const result = db.query('sum($doc/catalog/book/@price)');
    expect(result.data).toEqual([50]);
  });

  it('should atomize attribute nodes passed to max()', () => {
    const result = db.query('max($doc/catalog/book/@price)');
    expect(result.data).toEqual([25]);
  });

  it('should return 0 for sum of an empty sequence', () => {
    const result = db.query('sum(())');
    expect(result.data).toEqual([0]);
  });
});
