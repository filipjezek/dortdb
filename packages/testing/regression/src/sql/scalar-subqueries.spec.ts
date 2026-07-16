import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { defaultRules } from '@dortdb/core/optimizer';

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
