import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { defaultRules } from '@dortdb/core/optimizer';

// Postgres reference: a scalar subquery producing no rows evaluates to NULL
// and must not change the outer row count.
//   SELECT (SELECT n FROM nums n2 WHERE n2.n > 100) FROM nums WHERE n = 1
// returns exactly one row. DortDB duplicates the outer row instead.
describe('SQL - scalar subqueries', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['nums'], [{ n: 1 }, { n: 2 }]);

  it('should evaluate an empty scalar subquery as NULL without duplicating rows', () => {
    const result = db.query(`
      SELECT (SELECT n2.n FROM nums n2 WHERE n2.n > 100) AS r
      FROM nums WHERE n = 1
    `);
    expect(result.data).toEqual([{ r: null }]);
  });
});
