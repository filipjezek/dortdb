import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { defaultRules } from '@dortdb/core/optimizer';

// Postgres reference for nums = (1, 2, 5), vals = (1, 3):
//   n = ANY (SELECT v FROM vals)                -> 1
//   n > ALL (SELECT v FROM vals)                -> 5
//   n > ALL (SELECT v FROM vals WHERE v > 100)  -> 1, 2, 5 (ALL over empty set is true)
// DortDB throws 'Operator returned more than one value' for multi-row
// quantified subqueries and returns nothing for the empty-set ALL case.
describe('SQL - quantified subqueries (ANY/SOME/ALL)', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['nums'], [{ n: 1 }, { n: 2 }, { n: 5 }]);
  db.registerSource(['vals'], [{ v: 1 }, { v: 3 }]);

  it('should evaluate = ANY over a multi-row subquery', () => {
    const result = db.query(
      'SELECT n FROM nums WHERE n = ANY (SELECT v FROM vals)',
    );
    expect(result.data).toEqual([{ n: 1 }]);
  });

  it('should evaluate > ALL over a multi-row subquery', () => {
    const result = db.query(
      'SELECT n FROM nums WHERE n > ALL (SELECT v FROM vals)',
    );
    expect(result.data).toEqual([{ n: 5 }]);
  });

  it('should evaluate > ALL over an empty subquery as true', () => {
    const result = db.query(
      'SELECT n FROM nums WHERE n > ALL (SELECT v FROM vals WHERE v > 100)',
    );
    expect(result.data).toEqual([{ n: 1 }, { n: 2 }, { n: 5 }]);
  });
});
