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

describe('SQL - filtering', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  for (const [name, rows] of Object.entries(tables)) {
    db.registerSource([name], rows);
  }

  it('SELECT n, m FROM nums WHERE m IS NULL', () => {
    const result = db.query('SELECT n, m FROM nums WHERE m IS NULL');
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { n: 2, m: null },
        { n: 5, m: null },
      ]),
    );
  });

  it('SELECT n FROM nums WHERE m > 15', () => {
    const result = db.query('SELECT n FROM nums WHERE m > 15');
    expect(sortRows(result.data)).toEqual(sortRows([{ n: 3 }, { n: 4 }]));
  });

  it('SELECT n FROM nums WHERE NOT (m > 15)', () => {
    const result = db.query('SELECT n FROM nums WHERE NOT (m > 15)');
    expect(sortRows(result.data)).toEqual(sortRows([{ n: 1 }]));
  });

  it('SELECT n FROM nums WHERE m > 15 OR m IS NULL', () => {
    const result = db.query('SELECT n FROM nums WHERE m > 15 OR m IS NULL');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ n: 2 }, { n: 3 }, { n: 4 }, { n: 5 }]),
    );
  });

  it('SELECT name FROM emps WHERE salary = 70', () => {
    const result = db.query('SELECT name FROM emps WHERE salary = 70');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ name: 'Carol' }, { name: 'Dave' }]),
    );
  });

  it('SELECT name FROM emps WHERE salary BETWEEN 60 AND 80', () => {
    const result = db.query(
      'SELECT name FROM emps WHERE salary BETWEEN 60 AND 80',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { name: 'Bob' },
        { name: 'Carol' },
        { name: 'Dave' },
        { name: 'Eve' },
      ]),
    );
  });

  it('SELECT name FROM emps WHERE salary NOT BETWEEN 60 AND 80', () => {
    const result = db.query(
      'SELECT name FROM emps WHERE salary NOT BETWEEN 60 AND 80',
    );
    expect(sortRows(result.data)).toEqual(sortRows([{ name: 'Alice' }]));
  });

  it("SELECT name FROM emps WHERE dept IN ('eng', 'hr')", () => {
    const result = db.query(
      "SELECT name FROM emps WHERE dept IN ('eng', 'hr')",
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ name: 'Alice' }, { name: 'Bob' }, { name: 'Eve' }]),
    );
  });

  it("SELECT name FROM emps WHERE dept NOT IN ('eng', 'hr')", () => {
    const result = db.query(
      "SELECT name FROM emps WHERE dept NOT IN ('eng', 'hr')",
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ name: 'Carol' }, { name: 'Dave' }]),
    );
  });

  it('SELECT n FROM nums WHERE m IN (10, 30)', () => {
    const result = db.query('SELECT n FROM nums WHERE m IN (10, 30)');
    expect(sortRows(result.data)).toEqual(sortRows([{ n: 1 }, { n: 3 }]));
  });

  it('SELECT n FROM nums WHERE m NOT IN (10, 30)', () => {
    const result = db.query('SELECT n FROM nums WHERE m NOT IN (10, 30)');
    expect(sortRows(result.data)).toEqual(sortRows([{ n: 4 }]));
  });

  it('SELECT n FROM nums WHERE n IN (1, NULL)', () => {
    const result = db.query('SELECT n FROM nums WHERE n IN (1, NULL)');
    expect(sortRows(result.data)).toEqual(sortRows([{ n: 1 }]));
  });

  it('SELECT n FROM nums WHERE n NOT IN (1, NULL)', () => {
    const result = db.query('SELECT n FROM nums WHERE n NOT IN (1, NULL)');
    expect(sortRows(result.data)).toEqual(sortRows([]));
  });

  it('SELECT n FROM nums WHERE n BETWEEN 4 AND 2', () => {
    const result = db.query('SELECT n FROM nums WHERE n BETWEEN 4 AND 2');
    expect(sortRows(result.data)).toEqual(sortRows([]));
  });

  it('SELECT n FROM nums WHERE 1 < n AND n < 4', () => {
    const result = db.query('SELECT n FROM nums WHERE 1 < n AND n < 4');
    expect(sortRows(result.data)).toEqual(sortRows([{ n: 2 }, { n: 3 }]));
  });
});
