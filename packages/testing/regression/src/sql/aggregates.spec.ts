import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { defaultRules } from '@dortdb/core/optimizer';

describe('SQL - aggregates', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(
    ['test'],
    [{ x: 1 }, { x: 3 }, { x: 2 }, { x: 1 }, { x: 13 }, { x: 3 }],
  );

  it('should count distinct values', () => {
    const result = db.query(`
      SELECT COUNT(DISTINCT x) AS distinctCount
      FROM test
    `);
    expect(result.data).toEqual([{ distinctCount: 4 }]);
  });

  it('should count odd values', () => {
    const result = db.query(`
      SELECT COUNT(x) FILTER (WHERE x % 2 = 1) AS oddCount
      FROM test
    `);
    expect(result.data).toEqual([{ oddCount: 5 }]);
  });

  it('should collect sorted values', () => {
    const result = db.query(`
      SELECT collect(x ORDER BY x) AS sortedValues
      FROM test
    `);
    expect(result.data).toEqual([{ sortedValues: [1, 1, 2, 3, 3, 13] }]);
  });
});
