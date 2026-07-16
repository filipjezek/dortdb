import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { defaultRules } from '@dortdb/core/optimizer';

// Postgres reference: walking a management chain with WITH RECURSIVE + JOIN
// yields Dave, Carol, Alice. DortDB crashes with
// "Cannot read properties of undefined (reading 'parts')".
describe('SQL - recursive CTE with a join', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(
    ['emps'],
    [
      { id: 1, name: 'Alice', mgr: null },
      { id: 3, name: 'Carol', mgr: 1 },
      { id: 4, name: 'Dave', mgr: 3 },
    ],
  );

  it('should walk the management chain', () => {
    const result = db.query(`
      WITH RECURSIVE chain AS (
        SELECT id, name, mgr FROM emps WHERE id = 4
        UNION ALL
        SELECT e.id, e.name, e.mgr FROM emps e JOIN chain c ON e.id = c.mgr
      )
      SELECT name FROM chain
    `);
    expect(result.data).toEqual([
      { name: 'Dave' },
      { name: 'Carol' },
      { name: 'Alice' },
    ]);
  });
});
