import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { defaultRules } from '@dortdb/core/optimizer';

// Postgres reference:
//   SELECT x IS NOT NULL FROM (VALUES (1), (NULL)) t(x)     -> true, false
//   SELECT (x > 0) IS NOT TRUE FROM (VALUES (1), (NULL)) t(x) -> false, true
describe('SQL - IS NOT predicates', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['test'], [{ x: 1 }, { x: null }]);

  it('should evaluate IS NOT NULL in a projection', () => {
    const result = db.query('SELECT x IS NOT NULL AS r FROM test');
    expect(result.data).toEqual([{ r: true }, { r: false }]);
  });

  it('should filter with IS NOT NULL', () => {
    const result = db.query('SELECT x FROM test WHERE x IS NOT NULL');
    expect(result.data).toEqual([{ x: 1 }]);
  });

  it('should evaluate IS NOT TRUE', () => {
    const result = db.query('SELECT (x > 0) IS NOT TRUE AS r FROM test');
    expect(result.data).toEqual([{ r: false }, { r: true }]);
  });
});
