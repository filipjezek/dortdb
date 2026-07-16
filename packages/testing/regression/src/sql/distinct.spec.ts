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

describe('SQL - DISTINCT and DISTINCT ON', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  for (const [name, rows] of Object.entries(tables)) {
    db.registerSource([name], rows);
  }

  it('SELECT DISTINCT dept FROM emps', () => {
    const result = db.query('SELECT DISTINCT dept FROM emps');
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { dept: 'eng' },
        { dept: 'sales' },
        { dept: 'hr' },
        { dept: null },
      ]),
    );
  });

  it('SELECT DISTINCT salary, dept FROM emps', () => {
    const result = db.query('SELECT DISTINCT salary, dept FROM emps');
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { salary: 100, dept: 'eng' },
        { salary: 80, dept: 'eng' },
        { salary: 70, dept: 'sales' },
        { salary: 60, dept: 'hr' },
        { salary: null, dept: null },
      ]),
    );
  });

  it('SELECT DISTINCT ON (dept) dept, name FROM emps ORDER BY dept, salary DESC', () => {
    const result = db.query(
      'SELECT DISTINCT ON (dept) dept, name FROM emps ORDER BY dept, salary DESC',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { dept: 'eng', name: 'Alice' },
        { dept: 'hr', name: 'Eve' },
        { dept: 'sales', name: 'Carol' },
        { dept: null, name: 'Frank' },
      ]),
    );
  });

  it('SELECT DISTINCT ON (salary) salary, name FROM emps ORDER BY salary DESC NULLS LAST, name ASC', () => {
    const result = db.query(
      'SELECT DISTINCT ON (salary) salary, name FROM emps ORDER BY salary DESC NULLS LAST, name ASC',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { salary: 100, name: 'Alice' },
        { salary: 80, name: 'Bob' },
        { salary: 70, name: 'Carol' },
        { salary: 60, name: 'Eve' },
        { salary: null, name: 'Frank' },
      ]),
    );
  });
});
