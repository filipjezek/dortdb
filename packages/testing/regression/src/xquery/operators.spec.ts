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

describe('XQuery - operators and conditionals', () => {
  it('1 + 2 * 3', () => {
    const db = makeDb();
    expect(db.query('1 + 2 * 3').data.map(ser)).toEqual([7]);
  });

  it('7 idiv 2', () => {
    const db = makeDb();
    expect(db.query('7 idiv 2').data.map(ser)).toEqual([3]);
  });

  it('7 mod 2', () => {
    const db = makeDb();
    expect(db.query('7 mod 2').data.map(ser)).toEqual([1]);
  });

  it('2 = 2.0', () => {
    const db = makeDb();
    expect(db.query('2 = 2.0').data.map(ser)).toEqual([true]);
  });

  it('"a" eq "a"', () => {
    const db = makeDb();
    expect(db.query('"a" eq "a"').data.map(ser)).toEqual([true]);
  });

  it('(1, 2) = (2, 3)', () => {
    const db = makeDb();
    expect(db.query('(1, 2) = (2, 3)').data.map(ser)).toEqual([true]);
  });

  it('(1, 2) != (1, 2)', () => {
    const db = makeDb();
    expect(db.query('(1, 2) != (1, 2)').data.map(ser)).toEqual([true]);
  });

  it('if (1 < 2) then "yes" else "no"', () => {
    const db = makeDb();
    expect(db.query('if (1 < 2) then "yes" else "no"').data.map(ser)).toEqual([
      'yes',
    ]);
  });

  it('if (()) then "yes" else "no"', () => {
    const db = makeDb();
    expect(db.query('if (()) then "yes" else "no"').data.map(ser)).toEqual([
      'no',
    ]);
  });

  it('true() and false()', () => {
    const db = makeDb();
    expect(db.query('true() and false()').data.map(ser)).toEqual([false]);
  });

  it('true() or false()', () => {
    const db = makeDb();
    expect(db.query('true() or false()').data.map(ser)).toEqual([true]);
  });

  it('not(true())', () => {
    const db = makeDb();
    expect(db.query('not(true())').data.map(ser)).toEqual([false]);
  });

  it('some $x in (1, 2, 3) satisfies $x > 2', () => {
    const db = makeDb();
    expect(
      db.query('some $x in (1, 2, 3) satisfies $x > 2').data.map(ser),
    ).toEqual([true]);
  });

  it('every $x in (1, 2, 3) satisfies $x > 0', () => {
    const db = makeDb();
    expect(
      db.query('every $x in (1, 2, 3) satisfies $x > 0').data.map(ser),
    ).toEqual([true]);
  });

  it('every $x in () satisfies $x > 100', () => {
    const db = makeDb();
    expect(db.query('every $x in () satisfies $x > 100').data.map(ser)).toEqual(
      [true],
    );
  });
});
