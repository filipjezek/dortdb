// @vitest-environment jsdom
import { DortDB } from '@dortdb/core';
import { XQuery, DomDataAdapter } from '@dortdb/lang-xquery';
import { defaultRules } from '@dortdb/core/optimizer';

// XQuery 3.0: enclosed expressions in element constructors *copy* the produced
// nodes into the new element. DortDB instead
//   1. stringifies sequences of elements ('[object Element],[object Element]'),
//   2. *moves* source-document nodes into the constructed element, mutating the
//      queried document (DortDB promises to be read-only).
describe('XQuery - element constructors', () => {
  const xml = `<catalog><book id="b1"><title>A</title></book><book id="b2"><title>B</title></book></catalog>`;
  const serialize = (node: Node) => new XMLSerializer().serializeToString(node);

  function makeDb() {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const db = new DortDB({
      mainLang: XQuery({ adapter: new DomDataAdapter(doc) }),
      optimizer: { rules: defaultRules },
    });
    db.registerSource(['doc'], doc);
    return { db, doc };
  }

  it('should construct an element with atomic content', () => {
    // verified against fontoxpath; passes today
    const { db } = makeDb();
    const result = db.query('<greeting>{ 1 + 1 }</greeting>');
    expect(serialize(result.data[0] as Node)).toBe('<greeting>2</greeting>');
  });

  it('should insert constructed child elements instead of stringifying them', () => {
    const { db } = makeDb();
    const result = db.query(
      '<r>{ for $b in $doc/catalog/book return <t>{ string($b/@id) }</t> }</r>',
    );
    expect(serialize(result.data[0] as Node)).toBe('<r><t>b1</t><t>b2</t></r>');
  });

  it('should copy source nodes rather than move them', () => {
    const { db, doc } = makeDb();
    const result = db.query('<wrap>{ $doc/catalog/book[1]/title }</wrap>');
    expect(serialize(result.data[0] as Node)).toBe(
      '<wrap><title>A</title></wrap>',
    );
    // the queried document must not be mutated
    expect(serialize(doc.documentElement)).toBe(xml);
  });
});
