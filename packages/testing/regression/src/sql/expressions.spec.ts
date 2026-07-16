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

describe('SQL - expressions', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  for (const [name, rows] of Object.entries(tables)) {
    db.registerSource([name], rows);
  }

  it('SELECT n + m AS s FROM nums', () => {
    const result = db.query('SELECT n + m AS s FROM nums');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ s: 11 }, { s: null }, { s: 33 }, { s: 44 }, { s: null }]),
    );
  });

  it("SELECT CASE WHEN n % 2 = 0 THEN 'even' ELSE 'odd' END AS p FROM nums", () => {
    const result = db.query(
      "SELECT CASE WHEN n % 2 = 0 THEN 'even' ELSE 'odd' END AS p FROM nums",
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { p: 'odd' },
        { p: 'even' },
        { p: 'odd' },
        { p: 'even' },
        { p: 'odd' },
      ]),
    );
  });

  it('SELECT CASE WHEN m > 15 THEN 1 END AS p FROM nums', () => {
    const result = db.query(
      'SELECT CASE WHEN m > 15 THEN 1 END AS p FROM nums',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ p: null }, { p: null }, { p: 1 }, { p: 1 }, { p: null }]),
    );
  });

  it("SELECT CASE n WHEN 1 THEN 'one' WHEN 2 THEN 'two' ELSE 'many' END AS w FROM nums", () => {
    const result = db.query(
      "SELECT CASE n WHEN 1 THEN 'one' WHEN 2 THEN 'two' ELSE 'many' END AS w FROM nums",
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { w: 'one' },
        { w: 'two' },
        { w: 'many' },
        { w: 'many' },
        { w: 'many' },
      ]),
    );
  });

  it('SELECT coalesce(m, 0) AS c FROM nums', () => {
    const result = db.query('SELECT coalesce(m, 0) AS c FROM nums');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ c: 10 }, { c: 0 }, { c: 30 }, { c: 40 }, { c: 0 }]),
    );
  });

  it('SELECT 1 + 2 * 3 AS r FROM nums WHERE n = 1', () => {
    const result = db.query('SELECT 1 + 2 * 3 AS r FROM nums WHERE n = 1');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: 7 }]));
  });

  it('SELECT -n AS r FROM nums', () => {
    const result = db.query('SELECT -n AS r FROM nums');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ r: -1 }, { r: -2 }, { r: -3 }, { r: -4 }, { r: -5 }]),
    );
  });

  it('SELECT n % 3 AS r FROM nums', () => {
    const result = db.query('SELECT n % 3 AS r FROM nums');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ r: 1 }, { r: 2 }, { r: 0 }, { r: 1 }, { r: 2 }]),
    );
  });

  it('SELECT n ^ 2 AS r FROM nums', () => {
    const result = db.query('SELECT n ^ 2 AS r FROM nums');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ r: 1 }, { r: 4 }, { r: 9 }, { r: 16 }, { r: 25 }]),
    );
  });

  it('SELECT salary IS NULL AS r FROM emps', () => {
    const result = db.query('SELECT salary IS NULL AS r FROM emps');
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { r: false },
        { r: false },
        { r: false },
        { r: false },
        { r: false },
        { r: true },
      ]),
    );
  });

  it('SELECT NULL = NULL AS r FROM nums WHERE n = 1', () => {
    const result = db.query('SELECT NULL = NULL AS r FROM nums WHERE n = 1');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: null }]));
  });

  it('SELECT (1 = 1) AND (NULL IS NULL) AS r FROM nums WHERE n = 1', () => {
    const result = db.query(
      'SELECT (1 = 1) AND (NULL IS NULL) AS r FROM nums WHERE n = 1',
    );
    expect(sortRows(result.data)).toEqual(sortRows([{ r: true }]));
  });

  it('SELECT (salary > 70) IS TRUE AS r FROM emps', () => {
    const result = db.query('SELECT (salary > 70) IS TRUE AS r FROM emps');
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { r: true },
        { r: true },
        { r: false },
        { r: false },
        { r: false },
        { r: false },
      ]),
    );
  });

  it('SELECT (salary > 70) IS FALSE AS r FROM emps', () => {
    const result = db.query('SELECT (salary > 70) IS FALSE AS r FROM emps');
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { r: false },
        { r: false },
        { r: true },
        { r: true },
        { r: true },
        { r: false },
      ]),
    );
  });

  it('SELECT (salary > 70) IS NOT FALSE AS r FROM emps', () => {
    const result = db.query('SELECT (salary > 70) IS NOT FALSE AS r FROM emps');
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { r: false },
        { r: false },
        { r: true },
        { r: true },
        { r: true },
        { r: false },
      ]),
    );
  });

  it('SELECT (salary > 70) IS NULL AS r FROM emps', () => {
    const result = db.query('SELECT (salary > 70) IS NULL AS r FROM emps');
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { r: false },
        { r: false },
        { r: false },
        { r: false },
        { r: false },
        { r: true },
      ]),
    );
  });

  it('SELECT 1 + 1 AS r', () => {
    const result = db.query('SELECT 1 + 1 AS r');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: 2 }]));
  });

  it('SELECT NOT (m > 15) AS r FROM nums', () => {
    const result = db.query('SELECT NOT (m > 15) AS r FROM nums');
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { r: true },
        { r: null },
        { r: false },
        { r: false },
        { r: null },
      ]),
    );
  });

  it('SELECT 5 % 3 AS a, -5 % 3 AS b', () => {
    const result = db.query('SELECT 5 % 3 AS a, -5 % 3 AS b');
    expect(sortRows(result.data)).toEqual(sortRows([{ a: 2, b: -2 }]));
  });

  it('SELECT 2 ^ 10 AS r', () => {
    const result = db.query('SELECT 2 ^ 10 AS r');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: 1024 }]));
  });

  it('SELECT CASE WHEN m IS NULL THEN 0 ELSE m END AS r FROM nums', () => {
    const result = db.query(
      'SELECT CASE WHEN m IS NULL THEN 0 ELSE m END AS r FROM nums',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ r: 10 }, { r: 0 }, { r: 30 }, { r: 40 }, { r: 0 }]),
    );
  });

  it('SELECT coalesce(NULL, m, n, 99) AS r FROM nums', () => {
    const result = db.query('SELECT coalesce(NULL, m, n, 99) AS r FROM nums');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ r: 10 }, { r: 2 }, { r: 30 }, { r: 40 }, { r: 5 }]),
    );
  });
});
