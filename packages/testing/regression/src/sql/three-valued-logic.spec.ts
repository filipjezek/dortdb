import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { defaultRules } from '@dortdb/core/optimizer';

// Postgres reference (SQL three-valued logic):
//   NULL AND false -> false        NULL AND true -> NULL
//   NULL OR true   -> true         NULL OR false -> NULL
// DortDB evaluates AND/OR with JS truthiness, so NULL AND false yields NULL
// and NULL OR false yields false.
describe('SQL - three-valued logic', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  // x is always NULL; y controls the other operand
  db.registerSource(
    ['test'],
    [
      { id: 1, x: null, y: -1 },
      { id: 2, x: null, y: 1 },
    ],
  );

  it('should evaluate NULL AND false as false', () => {
    const result = db.query('SELECT id, (x > 0) AND (y > 0) AS r FROM test');
    expect(result.data).toEqual([
      { id: 1, r: false }, // NULL AND false -> false
      { id: 2, r: null }, // NULL AND true -> NULL
    ]);
  });

  it('should evaluate NULL OR true as true', () => {
    const result = db.query('SELECT id, (x > 0) OR (y > 0) AS r FROM test');
    expect(result.data).toEqual([
      { id: 1, r: null }, // NULL OR false -> NULL
      { id: 2, r: true }, // NULL OR true -> true
    ]);
  });
});
