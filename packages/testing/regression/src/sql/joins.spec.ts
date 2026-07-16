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

describe('SQL - joins', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  for (const [name, rows] of Object.entries(tables)) {
    db.registerSource([name], rows);
  }

  it('SELECT e.name, d.budget FROM emps e JOIN depts d ON e.dept = d.dname', () => {
    const result = db.query(
      'SELECT e.name, d.budget FROM emps e JOIN depts d ON e.dept = d.dname',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { 'e.name': 'Alice', 'd.budget': 1000 },
        { 'e.name': 'Bob', 'd.budget': 1000 },
        { 'e.name': 'Carol', 'd.budget': 500 },
        { 'e.name': 'Dave', 'd.budget': 500 },
      ]),
    );
  });

  it('SELECT e.name, d.budget FROM emps e LEFT JOIN depts d ON e.dept = d.dname', () => {
    const result = db.query(
      'SELECT e.name, d.budget FROM emps e LEFT JOIN depts d ON e.dept = d.dname',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { 'e.name': 'Alice', 'd.budget': 1000 },
        { 'e.name': 'Bob', 'd.budget': 1000 },
        { 'e.name': 'Carol', 'd.budget': 500 },
        { 'e.name': 'Dave', 'd.budget': 500 },
        { 'e.name': 'Eve', 'd.budget': null },
        { 'e.name': 'Frank', 'd.budget': null },
      ]),
    );
  });

  it('SELECT e.name, d.dname FROM emps e RIGHT JOIN depts d ON e.dept = d.dname', () => {
    const result = db.query(
      'SELECT e.name, d.dname FROM emps e RIGHT JOIN depts d ON e.dept = d.dname',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { 'e.name': 'Alice', 'd.dname': 'eng' },
        { 'e.name': 'Bob', 'd.dname': 'eng' },
        { 'e.name': 'Carol', 'd.dname': 'sales' },
        { 'e.name': 'Dave', 'd.dname': 'sales' },
        { 'e.name': null, 'd.dname': 'marketing' },
      ]),
    );
  });

  it('SELECT e.name, d.dname FROM emps e FULL JOIN depts d ON e.dept = d.dname', () => {
    const result = db.query(
      'SELECT e.name, d.dname FROM emps e FULL JOIN depts d ON e.dept = d.dname',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { 'e.name': 'Alice', 'd.dname': 'eng' },
        { 'e.name': 'Bob', 'd.dname': 'eng' },
        { 'e.name': 'Carol', 'd.dname': 'sales' },
        { 'e.name': 'Dave', 'd.dname': 'sales' },
        { 'e.name': 'Eve', 'd.dname': null },
        { 'e.name': 'Frank', 'd.dname': null },
        { 'e.name': null, 'd.dname': 'marketing' },
      ]),
    );
  });

  it('SELECT a.name AS an, b.name AS bn FROM emps a JOIN emps b ON a.mgr = b.id', () => {
    const result = db.query(
      'SELECT a.name AS an, b.name AS bn FROM emps a JOIN emps b ON a.mgr = b.id',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { an: 'Bob', bn: 'Alice' },
        { an: 'Carol', bn: 'Alice' },
        { an: 'Dave', bn: 'Carol' },
        { an: 'Eve', bn: 'Alice' },
        { an: 'Frank', bn: 'Bob' },
      ]),
    );
  });

  it('SELECT e.name, s.mx FROM emps e JOIN LATERAL (SELECT max(n) AS mx FROM nums WHERE nums.n < e.id) s ON true', () => {
    const result = db.query(
      'SELECT e.name, s.mx FROM emps e JOIN LATERAL (SELECT max(n) AS mx FROM nums WHERE nums.n < e.id) s ON true',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { 'e.name': 'Alice', 's.mx': null },
        { 'e.name': 'Bob', 's.mx': 1 },
        { 'e.name': 'Carol', 's.mx': 2 },
        { 'e.name': 'Dave', 's.mx': 3 },
        { 'e.name': 'Eve', 's.mx': 4 },
        { 'e.name': 'Frank', 's.mx': 5 },
      ]),
    );
  });

  it('SELECT a.name AS an, b.name AS bn, d.budget FROM emps a JOIN emps b ON a.mgr = b.id JOIN depts d ON a.dept = d.dname WHERE d.budget > 400', () => {
    const result = db.query(
      'SELECT a.name AS an, b.name AS bn, d.budget FROM emps a JOIN emps b ON a.mgr = b.id JOIN depts d ON a.dept = d.dname WHERE d.budget > 400',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { an: 'Bob', bn: 'Alice', 'd.budget': 1000 },
        { an: 'Carol', bn: 'Alice', 'd.budget': 500 },
        { an: 'Dave', bn: 'Carol', 'd.budget': 500 },
      ]),
    );
  });

  it('SELECT e.name, d.budget FROM emps e LEFT JOIN depts d ON e.dept = d.dname AND d.budget > 600', () => {
    const result = db.query(
      'SELECT e.name, d.budget FROM emps e LEFT JOIN depts d ON e.dept = d.dname AND d.budget > 600',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { 'e.name': 'Alice', 'd.budget': 1000 },
        { 'e.name': 'Bob', 'd.budget': 1000 },
        { 'e.name': 'Carol', 'd.budget': null },
        { 'e.name': 'Dave', 'd.budget': null },
        { 'e.name': 'Eve', 'd.budget': null },
        { 'e.name': 'Frank', 'd.budget': null },
      ]),
    );
  });

  it('SELECT e.name, d.budget FROM emps e LEFT JOIN depts d ON e.dept = d.dname WHERE d.budget > 600', () => {
    const result = db.query(
      'SELECT e.name, d.budget FROM emps e LEFT JOIN depts d ON e.dept = d.dname WHERE d.budget > 600',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { 'e.name': 'Alice', 'd.budget': 1000 },
        { 'e.name': 'Bob', 'd.budget': 1000 },
      ]),
    );
  });
});
