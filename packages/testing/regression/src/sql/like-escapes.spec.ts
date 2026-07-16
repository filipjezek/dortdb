import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { defaultRules } from '@dortdb/core/optimizer';

// Postgres reference: backslash is the default LIKE escape character, so
//   s LIKE '100\% %'  matches only '100% sure' (literal percent sign),
//   s LIKE 'a\_b'     matches only 'a_b' (literal underscore).
// DortDB matches neither.
describe('SQL - LIKE escape characters', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(
    ['test'],
    [
      { s: '100% sure' },
      { s: '100x sure' },
      { s: '10\\% sure' },
      { s: '10\\x sure' },
      { s: 'a_b' },
      { s: 'axb' },
    ],
  );

  it('should treat backslash-escaped % as a literal percent sign', () => {
    const result = db.query(`SELECT s FROM test WHERE s LIKE '100\\% %'`);
    expect(result.data).toEqual([{ s: '100% sure' }]);
  });

  it('should treat backslash-escaped _ as a literal underscore', () => {
    const result = db.query(`SELECT s FROM test WHERE s LIKE 'a\\_b'`);
    expect(result.data).toEqual([{ s: 'a_b' }]);
  });

  it('should treat double backslashes as a literal backslash', () => {
    const result = db.query(`SELECT s FROM test WHERE s LIKE '10\\\\\\% sure'`);
    expect(result.data).toEqual([{ s: '10\\% sure' }]);
  });
});
