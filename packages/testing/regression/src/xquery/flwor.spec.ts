// @vitest-environment jsdom
import { DortDB } from '@dortdb/core';
import { XQuery, DomDataAdapter } from '@dortdb/lang-xquery';
import { defaultRules } from '@dortdb/core/optimizer';

// Expected results verified against fontoxpath over the same document.

const XML =
  '<catalog>\n  <book id="b1" price="10">\n    <title>SQL Basics</title>\n    <author>Ann</author>\n    <author>Ben</author>\n    <year>2001</year>\n  </book>\n  <book id="b2" price="25">\n    <title>XML Advanced</title>\n    <author>Cid</author>\n    <year>2005</year>\n  </book>\n  <book id="b3" price="15">\n    <title>Graphs</title>\n    <author>Ann</author>\n    <year>2003</year>\n  </book>\n</catalog>';

// a fresh document per test
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

describe('XQuery - FLWOR expressions', () => {
  it('for $b in $doc/catalog/book return string($b/title)', () => {
    const db = makeDb();
    expect(
      db
        .query('for $b in $doc/catalog/book return string($b/title)')
        .data.map(ser),
    ).toEqual(['SQL Basics', 'XML Advanced', 'Graphs']);
  });

  it('for $b in $doc/catalog/book return string($b/@price)', () => {
    const db = makeDb();
    expect(
      db
        .query('for $b in $doc/catalog/book return string($b/@price)')
        .data.map(ser),
    ).toEqual(['10', '25', '15']);
  });

  it('for $b in $doc/catalog/book let $p := $b/@price where $p > 12 return string($b/title)', () => {
    const db = makeDb();
    expect(
      db
        .query(
          'for $b in $doc/catalog/book let $p := $b/@price where $p > 12 return string($b/title)',
        )
        .data.map(ser),
    ).toEqual(['XML Advanced', 'Graphs']);
  });

  it('for $b in $doc/catalog/book order by number($b/@price) descending return string($b/title)', () => {
    const db = makeDb();
    expect(
      db
        .query(
          'for $b in $doc/catalog/book order by number($b/@price) descending return string($b/title)',
        )
        .data.map(ser),
    ).toEqual(['XML Advanced', 'Graphs', 'SQL Basics']);
  });

  it('for $b in $doc/catalog/book order by string($b/title) return string($b/@id)', () => {
    const db = makeDb();
    expect(
      db
        .query(
          'for $b in $doc/catalog/book order by string($b/title) return string($b/@id)',
        )
        .data.map(ser),
    ).toEqual(['b3', 'b1', 'b2']);
  });

  it('for $x in (1, 2, 3), $y in (10, 20) return $x * $y', () => {
    const db = makeDb();
    expect(
      db
        .query('for $x in (1, 2, 3), $y in (10, 20) return $x * $y')
        .data.map(ser),
    ).toEqual([10, 20, 20, 40, 30, 60]);
  });

  it('for $x in (1 to 3) let $y := $x * 10 return $y', () => {
    const db = makeDb();
    expect(
      db.query('for $x in (1 to 3) let $y := $x * 10 return $y').data.map(ser),
    ).toEqual([10, 20, 30]);
  });

  it('for $b in $doc/catalog/book where count($b/author) > 1 return string($b/@id)', () => {
    const db = makeDb();
    expect(
      db
        .query(
          'for $b in $doc/catalog/book where count($b/author) > 1 return string($b/@id)',
        )
        .data.map(ser),
    ).toEqual(['b1']);
  });
});
