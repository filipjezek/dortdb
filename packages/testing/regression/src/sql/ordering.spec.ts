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

describe('SQL - ordering', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  for (const [name, rows] of Object.entries(tables)) {
    db.registerSource([name], rows);
  }

  it('SELECT n FROM nums ORDER BY n DESC', () => {
    const result = db.query('SELECT n FROM nums ORDER BY n DESC');
    expect(result.data).toEqual([
      { n: 5 },
      { n: 4 },
      { n: 3 },
      { n: 2 },
      { n: 1 },
    ]);
  });

  it('SELECT n FROM nums ORDER BY m', () => {
    const result = db.query('SELECT n FROM nums ORDER BY m');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ n: 1 }, { n: 3 }, { n: 4 }, { n: 2 }, { n: 5 }]),
    );
  });

  it('SELECT n FROM nums ORDER BY m NULLS FIRST, n', () => {
    const result = db.query('SELECT n FROM nums ORDER BY m NULLS FIRST, n');
    expect(result.data).toEqual([
      { n: 2 },
      { n: 5 },
      { n: 1 },
      { n: 3 },
      { n: 4 },
    ]);
  });

  it('SELECT n FROM nums ORDER BY m DESC NULLS LAST, n', () => {
    const result = db.query('SELECT n FROM nums ORDER BY m DESC NULLS LAST, n');
    expect(result.data).toEqual([
      { n: 4 },
      { n: 3 },
      { n: 1 },
      { n: 2 },
      { n: 5 },
    ]);
  });

  it('SELECT name FROM emps WHERE mgr IS NULL OR mgr = 1 ORDER BY name', () => {
    const result = db.query(
      'SELECT name FROM emps WHERE mgr IS NULL OR mgr = 1 ORDER BY name',
    );
    expect(result.data).toEqual([
      { name: 'Alice' },
      { name: 'Bob' },
      { name: 'Carol' },
      { name: 'Eve' },
    ]);
  });

  it('SELECT name FROM emps ORDER BY salary DESC NULLS LAST, name', () => {
    const result = db.query(
      'SELECT name FROM emps ORDER BY salary DESC NULLS LAST, name',
    );
    expect(result.data).toEqual([
      { name: 'Alice' },
      { name: 'Bob' },
      { name: 'Carol' },
      { name: 'Dave' },
      { name: 'Eve' },
      { name: 'Frank' },
    ]);
  });

  it('SELECT n FROM nums ORDER BY -n', () => {
    const result = db.query('SELECT n FROM nums ORDER BY -n');
    expect(result.data).toEqual([
      { n: 5 },
      { n: 4 },
      { n: 3 },
      { n: 2 },
      { n: 1 },
    ]);
  });

  it('SELECT n FROM nums ORDER BY n % 2, n', () => {
    const result = db.query('SELECT n FROM nums ORDER BY n % 2, n');
    expect(result.data).toEqual([
      { n: 2 },
      { n: 4 },
      { n: 1 },
      { n: 3 },
      { n: 5 },
    ]);
  });

  it('SELECT name, salary FROM emps ORDER BY 2 DESC NULLS LAST, 1', () => {
    const result = db.query(
      'SELECT name, salary FROM emps ORDER BY 2 DESC NULLS LAST, 1',
    );
    expect(result.data).toEqual([
      { name: 'Alice', salary: 100 },
      { name: 'Bob', salary: 80 },
      { name: 'Carol', salary: 70 },
      { name: 'Dave', salary: 70 },
      { name: 'Eve', salary: 60 },
      { name: 'Frank', salary: null },
    ]);
  });

  it('SELECT name FROM emps ORDER BY dept', () => {
    const result = db.query('SELECT name FROM emps ORDER BY dept');
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Eve' },
        { name: 'Carol' },
        { name: 'Dave' },
        { name: 'Frank' },
      ]),
    );
  });
});
