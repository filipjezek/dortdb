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

describe('SQL - aggregates and grouping', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  for (const [name, rows] of Object.entries(tables)) {
    db.registerSource([name], rows);
  }

  it('SELECT count(*) AS c FROM nums', () => {
    const result = db.query('SELECT count(*) AS c FROM nums');
    expect(sortRows(result.data)).toEqual(sortRows([{ c: 5 }]));
  });

  it('SELECT count(m) AS c FROM nums', () => {
    const result = db.query('SELECT count(m) AS c FROM nums');
    expect(sortRows(result.data)).toEqual(sortRows([{ c: 3 }]));
  });

  it('SELECT sum(m) AS s, avg(m) AS a, min(m) AS mn, max(m) AS mx FROM nums', () => {
    const result = db.query(
      'SELECT sum(m) AS s, avg(m) AS a, min(m) AS mn, max(m) AS mx FROM nums',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ s: 80, a: 26.666666666666668, mn: 10, mx: 40 }]),
    );
  });

  it('SELECT sum(n) AS s FROM nums WHERE n > 100', () => {
    const result = db.query('SELECT sum(n) AS s FROM nums WHERE n > 100');
    expect(sortRows(result.data)).toEqual(sortRows([{ s: null }]));
  });

  it('SELECT count(*) AS c FROM nums WHERE n > 100', () => {
    const result = db.query('SELECT count(*) AS c FROM nums WHERE n > 100');
    expect(sortRows(result.data)).toEqual(sortRows([{ c: 0 }]));
  });

  it('SELECT dept, count(*) AS c FROM emps GROUP BY dept', () => {
    const result = db.query(
      'SELECT dept, count(*) AS c FROM emps GROUP BY dept',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { dept: 'eng', c: 2 },
        { dept: 'sales', c: 2 },
        { dept: 'hr', c: 1 },
        { dept: null, c: 1 },
      ]),
    );
  });

  it('SELECT dept, sum(salary) AS s FROM emps GROUP BY dept HAVING sum(salary) > 100', () => {
    const result = db.query(
      'SELECT dept, sum(salary) AS s FROM emps GROUP BY dept HAVING sum(salary) > 100',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { dept: 'eng', s: 180 },
        { dept: 'sales', s: 140 },
      ]),
    );
  });

  it('SELECT dept, count(*) AS c FROM emps GROUP BY dept ORDER BY c DESC, dept ASC', () => {
    const result = db.query(
      'SELECT dept, count(*) AS c FROM emps GROUP BY dept ORDER BY c DESC, dept ASC',
    );
    expect(result.data).toEqual([
      { dept: 'eng', c: 2 },
      { dept: 'sales', c: 2 },
      { dept: 'hr', c: 1 },
      { dept: null, c: 1 },
    ]);
  });

  it('SELECT count(DISTINCT salary) AS c FROM emps', () => {
    const result = db.query('SELECT count(DISTINCT salary) AS c FROM emps');
    expect(sortRows(result.data)).toEqual(sortRows([{ c: 4 }]));
  });

  it("SELECT count(salary) FILTER (WHERE dept = 'eng') AS c FROM emps", () => {
    const result = db.query(
      "SELECT count(salary) FILTER (WHERE dept = 'eng') AS c FROM emps",
    );
    expect(sortRows(result.data)).toEqual(sortRows([{ c: 2 }]));
  });

  it('SELECT sum(m) AS s, avg(m) AS a FROM nums', () => {
    const result = db.query('SELECT sum(m) AS s, avg(m) AS a FROM nums');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ s: 80, a: 26.666666666666668 }]),
    );
  });

  it('SELECT count(*) AS c FROM emps GROUP BY dept', () => {
    const result = db.query('SELECT count(*) AS c FROM emps GROUP BY dept');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ c: 2 }, { c: 2 }, { c: 1 }, { c: 1 }]),
    );
  });

  it('SELECT dept, count(*) AS c FROM emps WHERE salary > 60 GROUP BY dept', () => {
    const result = db.query(
      'SELECT dept, count(*) AS c FROM emps WHERE salary > 60 GROUP BY dept',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { dept: 'eng', c: 2 },
        { dept: 'sales', c: 2 },
      ]),
    );
  });

  it('SELECT salary / 10 AS b, count(*) AS c FROM emps GROUP BY salary / 10', () => {
    const result = db.query(
      'SELECT salary / 10 AS b, count(*) AS c FROM emps GROUP BY salary / 10',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { b: 10, c: 1 },
        { b: 8, c: 1 },
        { b: 7, c: 2 },
        { b: 6, c: 1 },
        { b: null, c: 1 },
      ]),
    );
  });

  it('SELECT dept, count(*) AS c FROM emps GROUP BY dept HAVING count(*) > 1', () => {
    const result = db.query(
      'SELECT dept, count(*) AS c FROM emps GROUP BY dept HAVING count(*) > 1',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { dept: 'eng', c: 2 },
        { dept: 'sales', c: 2 },
      ]),
    );
  });

  it('SELECT sum(salary) AS s FROM emps HAVING sum(salary) > 1000', () => {
    const result = db.query(
      'SELECT sum(salary) AS s FROM emps HAVING sum(salary) > 1000',
    );
    expect(sortRows(result.data)).toEqual(sortRows([]));
  });

  it('SELECT dept FROM emps GROUP BY dept HAVING max(salary) >= 70', () => {
    const result = db.query(
      'SELECT dept FROM emps GROUP BY dept HAVING max(salary) >= 70',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ dept: 'eng' }, { dept: 'sales' }]),
    );
  });

  it('SELECT avg(salary) AS a FROM emps', () => {
    const result = db.query('SELECT avg(salary) AS a FROM emps');
    expect(sortRows(result.data)).toEqual(sortRows([{ a: 76 }]));
  });

  it('SELECT sum(salary + 0) AS s FROM emps', () => {
    const result = db.query('SELECT sum(salary + 0) AS s FROM emps');
    expect(sortRows(result.data)).toEqual(sortRows([{ s: 380 }]));
  });

  it('SELECT max(name) AS mx, min(name) AS mn FROM emps', () => {
    const result = db.query(
      'SELECT max(name) AS mx, min(name) AS mn FROM emps',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ mx: 'Frank', mn: 'Alice' }]),
    );
  });

  it('SELECT sum(m) AS s FROM nums WHERE m IS NULL', () => {
    const result = db.query('SELECT sum(m) AS s FROM nums WHERE m IS NULL');
    expect(sortRows(result.data)).toEqual(sortRows([{ s: null }]));
  });

  it('SELECT min(m) AS mn, max(m) AS mx, avg(m) AS a FROM nums WHERE m IS NULL', () => {
    const result = db.query(
      'SELECT min(m) AS mn, max(m) AS mx, avg(m) AS a FROM nums WHERE m IS NULL',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ mn: null, mx: null, a: null }]),
    );
  });

  it('SELECT count(DISTINCT m) AS c FROM nums', () => {
    const result = db.query('SELECT count(DISTINCT m) AS c FROM nums');
    expect(sortRows(result.data)).toEqual(sortRows([{ c: 3 }]));
  });

  it('SELECT dept, count(DISTINCT salary) AS c FROM emps GROUP BY dept', () => {
    const result = db.query(
      'SELECT dept, count(DISTINCT salary) AS c FROM emps GROUP BY dept',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { dept: 'eng', c: 2 },
        { dept: 'sales', c: 1 },
        { dept: 'hr', c: 1 },
        { dept: null, c: 0 },
      ]),
    );
  });

  it('SELECT dept, sum(salary) AS s FROM emps GROUP BY dept ORDER BY sum(salary) DESC, dept', () => {
    const result = db.query(
      'SELECT dept, sum(salary) AS s FROM emps GROUP BY dept ORDER BY sum(salary) DESC, dept',
    );
    expect(result.data).toEqual([
      { dept: null, s: null },
      { dept: 'eng', s: 180 },
      { dept: 'sales', s: 140 },
      { dept: 'hr', s: 60 },
    ]);
  });

  it('SELECT sum(salary) - min(salary) AS r FROM emps', () => {
    const result = db.query('SELECT sum(salary) - min(salary) AS r FROM emps');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: 320 }]));
  });

  it('SELECT sum(salary) / count(salary) AS r FROM emps', () => {
    const result = db.query(
      'SELECT sum(salary) / count(salary) AS r FROM emps',
    );
    expect(sortRows(result.data)).toEqual(sortRows([{ r: 76 }]));
  });

  it('SELECT dept, min(salary) AS mn FROM emps GROUP BY dept', () => {
    const result = db.query(
      'SELECT dept, min(salary) AS mn FROM emps GROUP BY dept',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { dept: 'eng', mn: 80 },
        { dept: 'sales', mn: 70 },
        { dept: 'hr', mn: 60 },
        { dept: null, mn: null },
      ]),
    );
  });
});
