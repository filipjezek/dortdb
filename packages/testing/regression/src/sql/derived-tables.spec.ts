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

describe('SQL - derived tables', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  for (const [name, rows] of Object.entries(tables)) {
    db.registerSource([name], rows);
  }

  it('SELECT sub.d AS d FROM (SELECT dept AS d FROM emps) sub', () => {
    const result = db.query(
      'SELECT sub.d AS d FROM (SELECT dept AS d FROM emps) sub',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { d: 'eng' },
        { d: 'eng' },
        { d: 'sales' },
        { d: 'sales' },
        { d: 'hr' },
        { d: null },
      ]),
    );
  });

  it('SELECT d FROM (SELECT dept AS d FROM emps) sub', () => {
    const result = db.query('SELECT d FROM (SELECT dept AS d FROM emps) sub');
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { d: 'eng' },
        { d: 'eng' },
        { d: 'sales' },
        { d: 'sales' },
        { d: 'hr' },
        { d: null },
      ]),
    );
  });

  it('SELECT sub.dept AS d FROM (SELECT dept FROM emps) sub', () => {
    const result = db.query(
      'SELECT sub.dept AS d FROM (SELECT dept FROM emps) sub',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { d: 'eng' },
        { d: 'eng' },
        { d: 'sales' },
        { d: 'sales' },
        { d: 'hr' },
        { d: null },
      ]),
    );
  });

  it('SELECT sub.c AS c FROM (SELECT count(*) AS c FROM emps) sub', () => {
    const result = db.query(
      'SELECT sub.c AS c FROM (SELECT count(*) AS c FROM emps) sub',
    );
    expect(sortRows(result.data)).toEqual(sortRows([{ c: 6 }]));
  });

  it('SELECT sub.d AS d, sub.s AS s FROM (SELECT dept AS d, sum(salary) AS s FROM emps GROUP BY dept) sub WHERE sub.s > 100', () => {
    const result = db.query(
      'SELECT sub.d AS d, sub.s AS s FROM (SELECT dept AS d, sum(salary) AS s FROM emps GROUP BY dept) sub WHERE sub.s > 100',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { d: 'eng', s: 180 },
        { d: 'sales', s: 140 },
      ]),
    );
  });

  it('SELECT o.d AS d FROM (SELECT i.dept AS d FROM (SELECT dept FROM emps WHERE salary > 60) i) o', () => {
    const result = db.query(
      'SELECT o.d AS d FROM (SELECT i.dept AS d FROM (SELECT dept FROM emps WHERE salary > 60) i) o',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ d: 'eng' }, { d: 'eng' }, { d: 'sales' }, { d: 'sales' }]),
    );
  });
});
