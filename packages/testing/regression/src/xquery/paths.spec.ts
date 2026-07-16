// @vitest-environment jsdom
import { DortDB } from '@dortdb/core';
import { XQuery, DomDataAdapter } from '@dortdb/lang-xquery';
import { defaultRules } from '@dortdb/core/optimizer';

// Expected results verified against fontoxpath over the same document.

const XML =
  '<catalog>\n  <book id="b1" price="10">\n    <title>SQL Basics</title>\n    <author>Ann</author>\n    <author>Ben</author>\n    <year>2001</year>\n  </book>\n  <book id="b2" price="25">\n    <title>XML Advanced</title>\n    <author>Cid</author>\n    <year>2005</year>\n  </book>\n  <book id="b3" price="15">\n    <title>Graphs</title>\n    <author>Ann</author>\n    <year>2003</year>\n  </book>\n</catalog>';

// a fresh document per test: element constructors currently mutate the source
function makeDb() {
  const doc = new DOMParser().parseFromString(XML, 'text/xml');
  const db = new DortDB({
    mainLang: XQuery({ adapter: new DomDataAdapter(doc) }),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['doc'], doc);
  return db;
}

/** stable serialization of result items (nodes -> strings) */
function ser(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  const node = v as Node;
  if (typeof v === 'object' && node.nodeType) {
    if (node.nodeType === 2) {
      const attr = node as Attr;
      return `@${attr.name}=${attr.value}`;
    }
    if (node.nodeType === 3) return `text(${(node as Text).data})`;
    return new XMLSerializer().serializeToString(node).replace(/\s+/g, ' ');
  }
  return v;
}

describe('XQuery - path expressions', () => {
  it('$doc/catalog/book/title/text()', () => {
    const db = makeDb();
    expect(db.query('$doc/catalog/book/title/text()').data.map(ser)).toEqual([
      'text(SQL Basics)',
      'text(XML Advanced)',
      'text(Graphs)',
    ]);
  });

  it('$doc/catalog/book/@id', () => {
    const db = makeDb();
    expect(db.query('$doc/catalog/book/@id').data.map(ser)).toEqual([
      '@id=b1',
      '@id=b2',
      '@id=b3',
    ]);
  });

  it('$doc/catalog/book[@price > 12]/title/text()', () => {
    const db = makeDb();
    expect(
      db.query('$doc/catalog/book[@price > 12]/title/text()').data.map(ser),
    ).toEqual(['text(XML Advanced)', 'text(Graphs)']);
  });

  it('$doc/catalog/book[year > 2002]/@id', () => {
    const db = makeDb();
    expect(
      db.query('$doc/catalog/book[year > 2002]/@id').data.map(ser),
    ).toEqual(['@id=b2', '@id=b3']);
  });

  it('$doc/catalog/book[1]/title/text()', () => {
    const db = makeDb();
    expect(db.query('$doc/catalog/book[1]/title/text()').data.map(ser)).toEqual(
      ['text(SQL Basics)'],
    );
  });

  it('$doc/catalog/book[author = "Ann"]/@id', () => {
    const db = makeDb();
    expect(
      db.query('$doc/catalog/book[author = "Ann"]/@id').data.map(ser),
    ).toEqual(['@id=b1', '@id=b3']);
  });

  it('($doc/catalog/book/author)[2]/text()', () => {
    const db = makeDb();
    expect(
      db.query('($doc/catalog/book/author)[2]/text()').data.map(ser),
    ).toEqual(['text(Ben)']);
  });

  it('$doc//author/text()', () => {
    const db = makeDb();
    expect(db.query('$doc//author/text()').data.map(ser)).toEqual([
      'text(Ann)',
      'text(Ben)',
      'text(Cid)',
      'text(Ann)',
    ]);
  });

  it('count($doc/catalog/book)', () => {
    const db = makeDb();
    expect(db.query('count($doc/catalog/book)').data.map(ser)).toEqual([3]);
  });

  it('string($doc/catalog/book[1]/title)', () => {
    const db = makeDb();
    expect(
      db.query('string($doc/catalog/book[1]/title)').data.map(ser),
    ).toEqual(['SQL Basics']);
  });

  it('$doc//author[. = "Cid"]/parent::book/@id', () => {
    const db = makeDb();
    expect(
      db.query('$doc//author[. = "Cid"]/parent::book/@id').data.map(ser),
    ).toEqual(['@id=b2']);
  });

  it('$doc//title/../@id', () => {
    const db = makeDb();
    expect(db.query('$doc//title/../@id').data.map(ser)).toEqual([
      '@id=b1',
      '@id=b2',
      '@id=b3',
    ]);
  });

  it('$doc/catalog/book[@id]/@id', () => {
    const db = makeDb();
    expect(db.query('$doc/catalog/book[@id]/@id').data.map(ser)).toEqual([
      '@id=b1',
      '@id=b2',
      '@id=b3',
    ]);
  });
});
