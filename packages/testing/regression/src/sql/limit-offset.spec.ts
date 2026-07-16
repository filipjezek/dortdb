import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { defaultRules } from '@dortdb/core/optimizer';
import { tables } from './test-data.js';

// Expected results verified against PGlite (real Postgres) over the data in
// test-data.ts.

describe('SQL - LIMIT and OFFSET', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  for (const [name, rows] of Object.entries(tables)) {
    db.registerSource([name], rows);
  }

  it('should return no rows for LIMIT 0', () => {
    // KNOWN BUG: DortDB currently returns all rows (Postgres returns none)
    const result = db.query('SELECT n FROM nums ORDER BY n LIMIT 0');
    expect(result.data).toEqual([]);
  });

  it('SELECT n FROM nums ORDER BY n LIMIT 2', () => {
    const result = db.query('SELECT n FROM nums ORDER BY n LIMIT 2');
    expect(result.data).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('SELECT n FROM nums ORDER BY n LIMIT 2 OFFSET 2', () => {
    const result = db.query('SELECT n FROM nums ORDER BY n LIMIT 2 OFFSET 2');
    expect(result.data).toEqual([{ n: 3 }, { n: 4 }]);
  });

  it('SELECT n FROM nums ORDER BY n OFFSET 3', () => {
    const result = db.query('SELECT n FROM nums ORDER BY n OFFSET 3');
    expect(result.data).toEqual([{ n: 4 }, { n: 5 }]);
  });

  it('SELECT n FROM nums ORDER BY n LIMIT 100', () => {
    const result = db.query('SELECT n FROM nums ORDER BY n LIMIT 100');
    expect(result.data).toEqual([
      { n: 1 },
      { n: 2 },
      { n: 3 },
      { n: 4 },
      { n: 5 },
    ]);
  });

  it('SELECT n FROM nums ORDER BY n OFFSET 100', () => {
    const result = db.query('SELECT n FROM nums ORDER BY n OFFSET 100');
    expect(result.data).toEqual([]);
  });

  it('SELECT n FROM nums ORDER BY n LIMIT 1 + 1', () => {
    const result = db.query('SELECT n FROM nums ORDER BY n LIMIT 1 + 1');
    expect(result.data).toEqual([{ n: 1 }, { n: 2 }]);
  });
});
