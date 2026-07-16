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

describe('SQL - string operations', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  for (const [name, rows] of Object.entries(tables)) {
    db.registerSource([name], rows);
  }

  it("SELECT s FROM strs WHERE s LIKE '%an%'", () => {
    const result = db.query("SELECT s FROM strs WHERE s LIKE '%an%'");
    expect(sortRows(result.data)).toEqual(sortRows([{ s: 'Banana' }]));
  });

  it("SELECT s FROM strs WHERE s ILIKE '%AN%'", () => {
    const result = db.query("SELECT s FROM strs WHERE s ILIKE '%AN%'");
    expect(sortRows(result.data)).toEqual(sortRows([{ s: 'Banana' }]));
  });

  it("SELECT s FROM strs WHERE s LIKE '_pple'", () => {
    const result = db.query("SELECT s FROM strs WHERE s LIKE '_pple'");
    expect(sortRows(result.data)).toEqual(sortRows([{ s: 'apple' }]));
  });

  it("SELECT s || '!' AS e FROM strs", () => {
    const result = db.query("SELECT s || '!' AS e FROM strs");
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { e: 'apple!' },
        { e: 'Banana!' },
        { e: 'cherry_pie!' },
        { e: '!' },
        { e: null },
        { e: '100% sure!' },
      ]),
    );
  });

  it('SELECT substr(s, 2, 3) AS r FROM strs', () => {
    const result = db.query('SELECT substr(s, 2, 3) AS r FROM strs');
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { r: 'ppl' },
        { r: 'ana' },
        { r: 'her' },
        { r: '' },
        { r: null },
        { r: '00%' },
      ]),
    );
  });

  it("SELECT s FROM strs WHERE s LIKE '100%'", () => {
    const result = db.query("SELECT s FROM strs WHERE s LIKE '100%'");
    expect(sortRows(result.data)).toEqual(sortRows([{ s: '100% sure' }]));
  });

  it("SELECT s FROM strs WHERE s LIKE 'cherry_pie'", () => {
    const result = db.query("SELECT s FROM strs WHERE s LIKE 'cherry_pie'");
    expect(sortRows(result.data)).toEqual(sortRows([{ s: 'cherry_pie' }]));
  });

  it("SELECT s FROM strs WHERE s NOT LIKE '%e%'", () => {
    const result = db.query("SELECT s FROM strs WHERE s NOT LIKE '%e%'");
    expect(sortRows(result.data)).toEqual(
      sortRows([{ s: 'Banana' }, { s: '' }]),
    );
  });

  it("SELECT s FROM strs WHERE s = ''", () => {
    const result = db.query("SELECT s FROM strs WHERE s = ''");
    expect(sortRows(result.data)).toEqual(sortRows([{ s: '' }]));
  });

  it("SELECT 'a' || 'b' AS r", () => {
    const result = db.query("SELECT 'a' || 'b' AS r");
    expect(sortRows(result.data)).toEqual(sortRows([{ r: 'ab' }]));
  });

  it("SELECT s FROM strs WHERE s > 'a'", () => {
    const result = db.query("SELECT s FROM strs WHERE s > 'a'");
    expect(sortRows(result.data)).toEqual(
      sortRows([{ s: 'apple' }, { s: 'cherry_pie' }]),
    );
  });

  it('SELECT s FROM strs ORDER BY s NULLS LAST', () => {
    const result = db.query('SELECT s FROM strs ORDER BY s NULLS LAST');
    expect(result.data).toEqual([
      { s: '' },
      { s: '100% sure' },
      { s: 'Banana' },
      { s: 'apple' },
      { s: 'cherry_pie' },
      { s: null },
    ]);
  });

  it("SELECT s FROM strs WHERE s ILIKE 'banana'", () => {
    const result = db.query("SELECT s FROM strs WHERE s ILIKE 'banana'");
    expect(sortRows(result.data)).toEqual(sortRows([{ s: 'Banana' }]));
  });
});
