// @vitest-environment jsdom
import { DortDB } from '@dortdb/core';
import { XQuery, DomDataAdapter } from '@dortdb/lang-xquery';
import { defaultRules } from '@dortdb/core/optimizer';

describe('XQuery - positional predicates', () => {
  const doc = new DOMParser().parseFromString(
    `<catalog>
      <book id="b1" price="10"><title>A</title></book>
      <book id="b2" price="25"><title>B</title></book>
      <book id="b3" price="15"><title>C</title></book>
    </catalog>`,
    'text/xml',
  );
  const db = new DortDB({
    mainLang: XQuery({ adapter: new DomDataAdapter(doc) }),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['doc'], doc);

  it('should evaluate last() in a predicate', () => {
    const result = db.query('(1, 2, 3)[last()]');
    expect(result.data).toEqual([3]);
  });

  it('should evaluate position() in a predicate', () => {
    const result = db.query(
      'for $id in $doc/catalog/book[position() = 2]/@id return string($id)',
    );
    expect(result.data).toEqual(['b2']);
  });

  it('should evaluate chained numeric predicates', () => {
    const result = db.query(
      'for $id in $doc/catalog/book[2][1]/@id return string($id)',
    );
    expect(result.data).toEqual(['b2']);
  });

  it('should evaluate a numeric predicate after a filtering predicate', () => {
    const result = db.query(
      'for $id in $doc/catalog/book[@price > 12][1]/@id return string($id)',
    );
    expect(result.data).toEqual(['b2']);
  });
});
