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

describe('SQL - subqueries', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  for (const [name, rows] of Object.entries(tables)) {
    db.registerSource([name], rows);
  }

  it('SELECT n FROM nums WHERE n IN (SELECT m / 10 FROM nums)', () => {
    const result = db.query(
      'SELECT n FROM nums WHERE n IN (SELECT m / 10 FROM nums)',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ n: 1 }, { n: 3 }, { n: 4 }]),
    );
  });

  it('SELECT n FROM nums WHERE n NOT IN (SELECT m / 10 FROM nums)', () => {
    const result = db.query(
      'SELECT n FROM nums WHERE n NOT IN (SELECT m / 10 FROM nums)',
    );
    expect(sortRows(result.data)).toEqual(sortRows([]));
  });

  it('SELECT n FROM nums WHERE EXISTS (SELECT 1 FROM emps WHERE emps.id = nums.n)', () => {
    const result = db.query(
      'SELECT n FROM nums WHERE EXISTS (SELECT 1 FROM emps WHERE emps.id = nums.n)',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }, { n: 5 }]),
    );
  });

  it('SELECT n FROM nums WHERE NOT EXISTS (SELECT 1 FROM emps WHERE emps.id = nums.n)', () => {
    const result = db.query(
      'SELECT n FROM nums WHERE NOT EXISTS (SELECT 1 FROM emps WHERE emps.id = nums.n)',
    );
    expect(sortRows(result.data)).toEqual(sortRows([]));
  });

  it('SELECT (SELECT max(salary) FROM emps) AS ms FROM nums WHERE n = 1', () => {
    const result = db.query(
      'SELECT (SELECT max(salary) FROM emps) AS ms FROM nums WHERE n = 1',
    );
    expect(sortRows(result.data)).toEqual(sortRows([{ ms: 100 }]));
  });

  it('SELECT e.name FROM emps e WHERE e.salary = (SELECT max(e2.salary) FROM emps e2 WHERE e2.dept = e.dept)', () => {
    const result = db.query(
      'SELECT e.name FROM emps e WHERE e.salary = (SELECT max(e2.salary) FROM emps e2 WHERE e2.dept = e.dept)',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { 'e.name': 'Alice' },
        { 'e.name': 'Carol' },
        { 'e.name': 'Dave' },
        { 'e.name': 'Eve' },
      ]),
    );
  });

  it('SELECT e.name, (SELECT count(*) FROM emps e2 WHERE e2.mgr = e.id) AS reports FROM emps e', () => {
    const result = db.query(
      'SELECT e.name, (SELECT count(*) FROM emps e2 WHERE e2.mgr = e.id) AS reports FROM emps e',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { 'e.name': 'Alice', reports: 3 },
        { 'e.name': 'Bob', reports: 1 },
        { 'e.name': 'Carol', reports: 1 },
        { 'e.name': 'Dave', reports: 0 },
        { 'e.name': 'Eve', reports: 0 },
        { 'e.name': 'Frank', reports: 0 },
      ]),
    );
  });

  it('SELECT n FROM nums WHERE n NOT IN (SELECT m FROM nums)', () => {
    const result = db.query(
      'SELECT n FROM nums WHERE n NOT IN (SELECT m FROM nums)',
    );
    expect(sortRows(result.data)).toEqual(sortRows([]));
  });

  it('SELECT d.dname FROM depts d WHERE EXISTS (SELECT 1 FROM emps e WHERE e.dept = d.dname AND e.salary > 75)', () => {
    const result = db.query(
      'SELECT d.dname FROM depts d WHERE EXISTS (SELECT 1 FROM emps e WHERE e.dept = d.dname AND e.salary > 75)',
    );
    expect(sortRows(result.data)).toEqual(sortRows([{ 'd.dname': 'eng' }]));
  });

  it('SELECT e.name FROM emps e WHERE e.id IN (SELECT e2.mgr FROM emps e2 WHERE e2.dept = e.dept)', () => {
    const result = db.query(
      'SELECT e.name FROM emps e WHERE e.id IN (SELECT e2.mgr FROM emps e2 WHERE e2.dept = e.dept)',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ 'e.name': 'Alice' }, { 'e.name': 'Carol' }]),
    );
  });

  it('SELECT d.dname FROM depts d WHERE NOT EXISTS (SELECT 1 FROM emps e WHERE e.dept = d.dname)', () => {
    const result = db.query(
      'SELECT d.dname FROM depts d WHERE NOT EXISTS (SELECT 1 FROM emps e WHERE e.dept = d.dname)',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ 'd.dname': 'marketing' }]),
    );
  });
});
