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

describe('SQL - set operations', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  for (const [name, rows] of Object.entries(tables)) {
    db.registerSource([name], rows);
  }

  it('SELECT n FROM nums UNION SELECT m / 10 FROM nums', () => {
    const result = db.query('SELECT n FROM nums UNION SELECT m / 10 FROM nums');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }, { n: 5 }, { n: null }]),
    );
  });

  it('SELECT n FROM nums UNION ALL SELECT n FROM nums', () => {
    const result = db.query('SELECT n FROM nums UNION ALL SELECT n FROM nums');
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { n: 1 },
        { n: 2 },
        { n: 3 },
        { n: 4 },
        { n: 5 },
        { n: 1 },
        { n: 2 },
        { n: 3 },
        { n: 4 },
        { n: 5 },
      ]),
    );
  });

  it('SELECT n FROM nums INTERSECT SELECT m / 10 FROM nums', () => {
    const result = db.query(
      'SELECT n FROM nums INTERSECT SELECT m / 10 FROM nums',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ n: 1 }, { n: 3 }, { n: 4 }]),
    );
  });

  it('SELECT n FROM nums EXCEPT SELECT m / 10 FROM nums', () => {
    const result = db.query(
      'SELECT n FROM nums EXCEPT SELECT m / 10 FROM nums',
    );
    expect(sortRows(result.data)).toEqual(sortRows([{ n: 2 }, { n: 5 }]));
  });

  it('SELECT dept FROM emps INTERSECT ALL SELECT dept FROM emps', () => {
    const result = db.query(
      'SELECT dept FROM emps INTERSECT ALL SELECT dept FROM emps',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { dept: 'eng' },
        { dept: 'eng' },
        { dept: 'sales' },
        { dept: 'sales' },
        { dept: 'hr' },
        { dept: null },
      ]),
    );
  });

  it('SELECT salary FROM emps EXCEPT ALL SELECT budget / 10 FROM depts', () => {
    const result = db.query(
      'SELECT salary FROM emps EXCEPT ALL SELECT budget / 10 FROM depts',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { salary: 80 },
        { salary: 70 },
        { salary: 70 },
        { salary: 60 },
        { salary: null },
      ]),
    );
  });

  it('SELECT dept FROM emps UNION SELECT dname FROM depts', () => {
    const result = db.query(
      'SELECT dept FROM emps UNION SELECT dname FROM depts',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { dept: 'eng' },
        { dept: 'sales' },
        { dept: 'hr' },
        { dept: null },
        { dept: 'marketing' },
      ]),
    );
  });

  it('SELECT dept FROM emps EXCEPT SELECT dname FROM depts', () => {
    const result = db.query(
      'SELECT dept FROM emps EXCEPT SELECT dname FROM depts',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ dept: 'hr' }, { dept: null }]),
    );
  });

  it('SELECT dept FROM emps INTERSECT SELECT dname FROM depts', () => {
    const result = db.query(
      'SELECT dept FROM emps INTERSECT SELECT dname FROM depts',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ dept: 'eng' }, { dept: 'sales' }]),
    );
  });

  it('SELECT n AS x FROM nums UNION ALL SELECT salary FROM emps', () => {
    const result = db.query(
      'SELECT n AS x FROM nums UNION ALL SELECT salary FROM emps',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { x: 1 },
        { x: 2 },
        { x: 3 },
        { x: 4 },
        { x: 5 },
        { x: 100 },
        { x: 80 },
        { x: 70 },
        { x: 70 },
        { x: 60 },
        { x: null },
      ]),
    );
  });
});
