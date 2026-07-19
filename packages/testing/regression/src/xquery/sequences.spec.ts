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

describe('XQuery - sequences', () => {
  it('(1, 2, 3)', () => {
    const db = makeDb();
    expect(db.query('(1, 2, 3)').data.map(ser)).toEqual([1, 2, 3]);
  });

  it('(1, (2, 3), ())', () => {
    const db = makeDb();
    expect(db.query('(1, (2, 3), ())').data.map(ser)).toEqual([1, 2, 3]);
  });

  it('1 to 5', () => {
    const db = makeDb();
    expect(db.query('1 to 5').data.map(ser)).toEqual([1, 2, 3, 4, 5]);
  });

  it('(5 to 10)[. mod 2 eq 1]', () => {
    const db = makeDb();
    expect(db.query('(5 to 10)[. mod 2 eq 1]').data.map(ser)).toEqual([
      5, 7, 9,
    ]);
  });

  it('sum((1, 2, 3))', () => {
    const db = makeDb();
    expect(db.query('sum((1, 2, 3))').data.map(ser)).toEqual([6]);
  });

  it('avg((1, 2, 3, 4))', () => {
    const db = makeDb();
    expect(db.query('avg((1, 2, 3, 4))').data.map(ser)).toEqual([2.5]);
  });

  it('min((3, 1, 2))', () => {
    const db = makeDb();
    expect(db.query('min((3, 1, 2))').data.map(ser)).toEqual([1]);
  });

  it('max((3, 1, 2))', () => {
    const db = makeDb();
    expect(db.query('max((3, 1, 2))').data.map(ser)).toEqual([3]);
  });

  it('count(())', () => {
    const db = makeDb();
    expect(db.query('count(())').data.map(ser)).toEqual([0]);
  });

  it('string(())', () => {
    const db = makeDb();
    expect(db.query('string(())').data.map(ser)).toEqual(['']);
  });
});
