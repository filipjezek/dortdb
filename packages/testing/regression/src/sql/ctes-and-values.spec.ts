import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { defaultRules } from '@dortdb/core/optimizer';
import { tables } from './test-data.js';

// Expected results verified against PGlite (real Postgres) over the data in
// test-data.ts.

/** order-insensitive row comparison for queries without a top-level ORDER BY */
const sortRows = (rows: unknown[]): string[] =>
  rows
    .map((r) =>
      JSON.stringify(r, (_, v) => (v === undefined ? '__undefined__' : v)),
    )
    .sort();

describe('SQL - CTEs and VALUES lists', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  for (const [name, rows] of Object.entries(tables)) {
    db.registerSource([name], rows);
  }

  it('WITH big AS (SELECT name, salary FROM emps WHERE salary > 65) SELECT b.name FROM big b', () => {
    const result = db.query(
      'WITH big AS (SELECT name, salary FROM emps WHERE salary > 65) SELECT b.name FROM big b',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { 'b.name': 'Alice' },
        { 'b.name': 'Bob' },
        { 'b.name': 'Carol' },
        { 'b.name': 'Dave' },
      ]),
    );
  });

  it('SELECT x.a FROM (VALUES (1), (2), (3)) x(a)', () => {
    const result = db.query('SELECT x.a FROM (VALUES (1), (2), (3)) x(a)');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ 'x.a': 1 }, { 'x.a': 2 }, { 'x.a': 3 }]),
    );
  });

  it('WITH RECURSIVE r AS (SELECT 1 AS i UNION ALL SELECT r.i + 1 FROM r WHERE r.i < 5) SELECT r.i FROM r', () => {
    const result = db.query(
      'WITH RECURSIVE r AS (SELECT 1 AS i UNION ALL SELECT r.i + 1 FROM r WHERE r.i < 5) SELECT r.i FROM r',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { 'r.i': 1 },
        { 'r.i': 2 },
        { 'r.i': 3 },
        { 'r.i': 4 },
        { 'r.i': 5 },
      ]),
    );
  });

  it('SELECT v.a AS a, v.b AS b FROM (VALUES (1 + 1, NULL), (3, 4)) v(a, b)', () => {
    const result = db.query(
      'SELECT v.a AS a, v.b AS b FROM (VALUES (1 + 1, NULL), (3, 4)) v(a, b)',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { a: 2, b: null },
        { a: 3, b: 4 },
      ]),
    );
  });

  it('SELECT v.a AS a FROM (VALUES (3), (1), (2)) v(a)', () => {
    const result = db.query('SELECT v.a AS a FROM (VALUES (3), (1), (2)) v(a)');
    expect(result.data).toEqual([{ a: 3 }, { a: 1 }, { a: 2 }]);
  });
});
